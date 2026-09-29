package com.rewear.api.recommendation;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.rewear.api.garment.GarmentDtos.DiscoveryCriteria;
import com.rewear.api.garment.GarmentService;
import com.rewear.api.profile.ProfileDtos.ProfileResponse;
import com.rewear.api.profile.ProfileService;
import com.rewear.api.recommendation.RecommendationDtos.DiscoveryRequest;
import com.rewear.api.recommendation.RecommendationDtos.Measurements;
import com.rewear.api.recommendation.RecommendationDtos.PreferenceRequest;
import com.rewear.api.recommendation.StylistUnderstandingService.InterpretedQuery;
import com.rewear.api.recommendation.StylistUnderstandingService.Understanding;

@Service
public class RecommendationService {
    private static final Set<String> STOP_WORDS = Set.of("i", "need", "want", "find", "show", "me", "a", "an", "the", "for", "with", "in", "on", "to", "under", "within", "near", "available", "outfit", "clothes", "clothing", "something", "similar", "this", "that", "from", "and", "by", "my", "next", "please", "rental", "rent");
    private static final Pattern WORD = Pattern.compile("[\\p{L}\\p{N}]{3,}");
    private static final Map<String, Integer> WEIGHTS = Map.ofEntries(
        Map.entry("occasion", 9), Map.entry("style", 6), Map.entry("colour", 5), Map.entry("category", 8),
        Map.entry("size", 12), Map.entry("budget", 9), Map.entry("availability", 14), Map.entry("proximity", 8),
        Map.entry("fulfilment", 4), Map.entry("reviews", 6), Map.entry("condition", 3), Map.entry("personalization", 3),
        Map.entry("popularity", 2), Map.entry("semantic", 7), Map.entry("inspiration", 4));

    private final NamedParameterJdbcTemplate jdbc;
    private final ProfileService profiles;
    private final GarmentService garments;
    private final StylistUnderstandingService stylist;
    private final MlServiceClient mlServiceClient;

    public RecommendationService(NamedParameterJdbcTemplate jdbc, ProfileService profiles,
                                 GarmentService garments, StylistUnderstandingService stylist,
                                 MlServiceClient mlServiceClient) {
        this.jdbc = jdbc;
        this.profiles = profiles;
        this.garments = garments;
        this.stylist = stylist;
        this.mlServiceClient = mlServiceClient;
    }

    private Map<String, Double> getMlScores(String query, List<Map<String, Object>> candidates) {
        if (query == null || query.isBlank() || candidates.isEmpty()) {
            return null;
        }
        
        List<java.util.UUID> candidateIds = candidates.stream()
            .map(c -> (java.util.UUID) c.get("id"))
            .toList();
            
        List<Map<String, Object>> embeddings = jdbc.queryForList("""
            SELECT product_id::text, embedding
            FROM product_embeddings
            WHERE model_name = 'all-MiniLM-L6-v2' AND product_id IN (:ids)
            """, Map.of("ids", candidateIds));
            
        if (embeddings.isEmpty()) {
            return null;
        }

        List<Map<String, Object>> productEmbeddings = new java.util.ArrayList<>();
        ObjectMapper mapper = new ObjectMapper();
        for (Map<String, Object> row : embeddings) {
            try {
                String productId = (String) row.get("product_id");
                Object pgObj = row.get("embedding");
                String jsonStr = pgObj.toString();
                
                List<Double> embeddingList = mapper.readValue(jsonStr, new com.fasterxml.jackson.core.type.TypeReference<List<Double>>() {});
                productEmbeddings.add(Map.of("product_id", productId, "embedding", embeddingList));
            } catch (Exception e) {
                // Ignore parsing errors for individual rows
            }
        }
        
        if (productEmbeddings.isEmpty()) {
            return null;
        }
        
        List<Map<String, Object>> mlResults = mlServiceClient.search(query, productEmbeddings, 100);
        if (mlResults == null) {
            return null;
        }
        
        Map<String, Double> scores = new HashMap<>();
        for (Map<String, Object> result : mlResults) {
            String productId = (String) result.get("product_id");
            Number score = (Number) result.get("score");
            if (productId != null && score != null) {
                scores.put(productId, score.doubleValue());
            }
        }
        return scores;
    }

    public Map<String, Object> discover(Jwt jwt, DiscoveryRequest request) {
        ProfileResponse profile = requirePersonal(jwt);
        validateRequest(request);
        if (request.inspirationImageData() != null && !Boolean.TRUE.equals(request.imageAnalysisConsent())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose the optional image analysis consent before searching with an inspiration photo.");
        }
        String imageData = validatedImage(request.inspirationImageData());
        Understanding understanding = stylist.understand(request.query(), imageData);
        InterpretedQuery parsed = understanding.query();
        Map<String, Object> preferences = preferences(profile.id());

        String occasion = first(request.occasion(), parsed.occasion(), "");
        String category = first(request.category(), parsed.category(), preferenceText(preferences, "preferredCategories"));
        String size = first(request.size(), "", string(preferences.get("preferredSize")));
        String style = first(request.style(), parsed.style(), firstList(preferences.get("preferredStyles")));
        String colour = first(request.colour(), parsed.colour(), firstList(preferences.get("preferredColours")));
        BigDecimal minimum = first(request.budgetMin(), decimal(parsed.budgetMin()), decimalOrNull(preferences.get("budgetMin")));
        BigDecimal maximum = first(request.budgetMax(), decimal(parsed.budgetMax()), decimalOrNull(preferences.get("budgetMax")));
        String area = first(request.area(), parsed.area(), string(preferences.get("preferredArea")));
        String postcode = first(request.postcode(), parsed.postcode(), string(preferences.get("preferredPostcode")));
        String fulfilment = normalizeFulfilment(first(request.fulfilment(), parsed.fulfilment(), string(preferences.get("fulfilment"))));
        Integer distanceKm = first(request.distanceKm(), integer(parsed.distanceKm()));
        LocalDate eventDate = first(request.eventDate(), date(parsed.eventDate()));
        LocalDate rentalStart = first(request.rentalStartDate(), date(parsed.rentalStartDate()));
        LocalDate rentalEnd = first(request.rentalEndDate(), date(parsed.rentalEndDate()));
        LocalDate today = LocalDate.now(java.time.ZoneId.of("Asia/Kolkata"));
        if (request.query() != null && request.query().toLowerCase(Locale.ROOT).matches(".*\\bavailable\\s+today\\b.*") && rentalStart == null) {
            rentalStart = today;
            rentalEnd = today.plusDays(1);
        }
        if (request.query() != null && request.query().toLowerCase(Locale.ROOT).matches(".*\\bavailable\\s+tomorrow\\b.*") && rentalStart == null) {
            rentalStart = today.plusDays(1);
            rentalEnd = rentalStart.plusDays(1);
        }
        if ("available-today".equals(normalizeSort(request.sort())) && rentalStart == null) {
            rentalStart = today;
            rentalEnd = today.plusDays(1);
        }
        boolean inferredEventRentalWindow = eventDate != null && rentalStart == null && rentalEnd == null;
        if (inferredEventRentalWindow) {
            rentalStart = eventDate.isAfter(today) ? eventDate.minusDays(1) : eventDate;
            rentalEnd = rentalStart.equals(eventDate) ? eventDate.plusDays(1) : eventDate;
        }
        validateDates(rentalStart, rentalEnd);
        if (eventDate != null && eventDate.isBefore(today)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose an event date that is today or later.");
        }
        boolean eventOutsideRentalWindow = eventDate != null && rentalStart != null
            && (eventDate.isBefore(rentalStart) || eventDate.isAfter(rentalEnd));

        BigDecimal latitude = coordinate(request.latitude());
        BigDecimal longitude = coordinate(request.longitude());
        if ((latitude == null) != (longitude == null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Location search needs both approximate coordinates.");
        }
        if (distanceKm != null && latitude == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose approximate device location to filter by distance, or search by area or PIN code.");
        }
        if ("purchase".equalsIgnoreCase(string(request.transactionType()))) {
            return emptyResponse(request, understanding, "ReWear currently supports rental requests. Purchase checkout is not available yet.");
        }

        Integer days = rentalStart == null ? null : Math.toIntExact(ChronoUnit.DAYS.between(rentalStart, rentalEnd));
        DiscoveryCriteria criteria = new DiscoveryCriteria(
            clean(occasion), clean(category), clean(size), clean(style), clean(colour), minimum, maximum, days, rentalStart, rentalEnd,
            clean(area), clean(postcode), latitude, longitude, distanceKm, fulfilment,
            clean(request.condition()), request.minimumRating(), request.premiumOnly(), 48, 0);
        List<Map<String, Object>> candidates = garments.discoveryCandidates(criteria);
        List<String> queryTerms = queryTerms(request.query(), parsed.keywords());
        Map<String, Double> mlScores = getMlScores(request.query(), candidates);
        List<Map<String, Object>> ranked = new ArrayList<>();
        for (Map<String, Object> candidate : candidates) {
            Map<String, Object> garment = normalizeGarment(candidate);
            Double distance = distanceKm == null && latitude == null ? null : distanceKm(
                latitude, longitude, decimalOrNull(garment.get("approximateLatitude")), decimalOrNull(garment.get("approximateLongitude")));
            Double mlScore = mlScores != null ? mlScores.get((String) garment.get("id")) : null;
            Match match = score(garment, occasion, category, style, colour, size, minimum, maximum, days,
                rentalStart, fulfilment, distance, distanceKm, preferences, queryTerms, imageData != null, parsed, mlScore);
            int estimateDays = days == null ? Math.max(1, integer(garment.get("days"))) : Math.max(1, days);
            BigDecimal estimatedRentalPrice = decimal(garment.get("price"))
                .multiply(BigDecimal.valueOf(estimateDays))
                .divide(BigDecimal.valueOf(Math.max(1, integer(garment.get("days")))), 0, RoundingMode.CEILING);
            garment.put("approximateDistanceKm", distance == null ? null : BigDecimal.valueOf(distance).setScale(1, RoundingMode.HALF_UP));
            garment.put("availableForDates", rentalStart == null ? null : true);
            garment.put("fitConfidence", fitConfidence(request.measurements(), size, garment));
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("garment", garment);
            item.put("matchPercent", match.percent());
            item.put("reasons", match.reasons());
            item.put("fitConfidence", garment.get("fitConfidence"));
            item.put("distanceKm", garment.get("approximateDistanceKm"));
            item.put("availableForDates", garment.get("availableForDates"));
            item.put("score", match.score());
            item.put("estimatedRentalPrice", estimatedRentalPrice);
            item.put("estimatedDays", estimateDays);
            ranked.add(item);
        }

        String sort = normalizeSort(request.sort());
        sort(ranked, sort);
        int total = ranked.size();
        int offset = Math.min(request.offset() == null ? 0 : request.offset(), total);
        int limit = request.limit() == null ? 24 : request.limit();
        List<Map<String, Object>> page = ranked.subList(offset, Math.min(total, offset + limit));
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", page);
        response.put("total", total);
        response.put("limit", limit);
        response.put("offset", offset);
        response.put("hasMore", offset + limit < total || candidates.size() >= 240);
        response.put("sort", sort);
        response.put("aiAssisted", understanding.aiAssisted());
        String notice = notice(understanding.notice(), request, distanceKm, latitude, candidates, total);
        if (inferredEventRentalWindow) {
            notice = (notice.isBlank() ? "" : notice + " ")
                + "No rental window was selected; availability is checked from the day before your event through the event date.";
        }
        if (eventOutsideRentalWindow) {
            notice = (notice.isBlank() ? "" : notice + " ")
                + "Your event date falls outside the rental dates; availability is checked against the rental dates you selected.";
        }
        response.put("notice", notice);
        response.put("summary", total == 0 ? "No outfits match all the selected requirements." :
            "We found " + (response.get("hasMore").equals(true) ? "at least " : "") + total + " outfit" + (total == 1 ? "" : "s") + " matching your requirements.");
        response.put("filters", filterSummary(occasion, eventDate, rentalStart, rentalEnd, category, size, style, colour,
            minimum, maximum, area, postcode, distanceKm, fulfilment, request));
        response.put("sections", sections(ranked, total));
        response.put("suggestions", suggestions(total, rentalStart, distanceKm, maximum, area));
        return response;
    }

    public List<Map<String, Object>> styleMatch(Jwt jwt, String category, Integer budget, String size, String area) {
        DiscoveryRequest request = new DiscoveryRequest(
            null, null, null, null, null,
            category, size, null, null, null,
            null, budget == null ? null : BigDecimal.valueOf(budget),
            area, null, null, null, null, null, null, null, null,
            "rental", "best-match", 48, 0, null, null);
        Map<String, Object> result = discover(jwt, request);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
        return items;
    }

    public Map<String, Object> getPreferences(Jwt jwt) {
        return preferences(requirePersonal(jwt).id());
    }

    @Transactional
    public Map<String, Object> savePreferences(Jwt jwt, PreferenceRequest request) {
        ProfileResponse profile = requirePersonal(jwt);
        String fulfilment = normalizeFulfilment(request.fulfilment());
        jdbc.update("""
            INSERT INTO recommendation_preferences (profile_id, preferred_categories, preferred_styles, preferred_colours,
                preferred_size, budget_min, budget_max, preferred_area, preferred_postcode, fulfilment, updated_at)
            VALUES (:profileId, string_to_array(:categories, ','), string_to_array(:styles, ','), string_to_array(:colours, ','),
                :size, :budgetMin, :budgetMax, :area, :postcode, :fulfilment, now())
            ON CONFLICT (profile_id) DO UPDATE SET preferred_categories = EXCLUDED.preferred_categories,
                preferred_styles = EXCLUDED.preferred_styles, preferred_colours = EXCLUDED.preferred_colours,
                preferred_size = EXCLUDED.preferred_size, budget_min = EXCLUDED.budget_min,
                budget_max = EXCLUDED.budget_max, preferred_area = EXCLUDED.preferred_area,
                preferred_postcode = EXCLUDED.preferred_postcode, fulfilment = EXCLUDED.fulfilment, updated_at = now()
            """, new MapSqlParameterSource()
                .addValue("profileId", UUID.fromString(profile.id()))
                .addValue("categories", join(request.preferredCategories()))
                .addValue("styles", join(request.preferredStyles()))
                .addValue("colours", join(request.preferredColours()))
                .addValue("size", clean(request.preferredSize()))
                .addValue("budgetMin", request.budgetMin()).addValue("budgetMax", request.budgetMax())
                .addValue("area", clean(request.preferredArea())).addValue("postcode", clean(request.preferredPostcode()))
                .addValue("fulfilment", fulfilment));
        return preferences(profile.id());
    }

    @Transactional
    public void clearPreferences(Jwt jwt) {
        ProfileResponse profile = requirePersonal(jwt);
        jdbc.update("DELETE FROM recommendation_preferences WHERE profile_id = :id", Map.of("id", UUID.fromString(profile.id())));
    }

    private Map<String, Object> preferences(String profileId) {
        UUID id = UUID.fromString(profileId);
        List<Map<String, Object>> rows = jdbc.queryForList("""
            SELECT preferred_categories AS "preferredCategories", preferred_styles AS "preferredStyles",
                   preferred_colours AS "preferredColours", preferred_size AS "preferredSize",
                   budget_min AS "budgetMin", budget_max AS "budgetMax", preferred_area AS "preferredArea",
                   preferred_postcode AS "preferredPostcode", fulfilment, updated_at AS "updatedAt"
            FROM recommendation_preferences WHERE profile_id = :id
            """, Map.of("id", id));
        if (rows.isEmpty()) return Map.of("saved", false);
        Map<String, Object> result = new LinkedHashMap<>(rows.getFirst());
        result.put("saved", true);
        result.put("preferredCategories", array(result.get("preferredCategories")));
        result.put("preferredStyles", array(result.get("preferredStyles")));
        result.put("preferredColours", array(result.get("preferredColours")));
        return result;
    }

    private ProfileResponse requirePersonal(Jwt jwt) {
        ProfileResponse profile = profiles.get(jwt);
        if (!"personal".equals(profile.role())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Outfit discovery is available to personal accounts.");
        }
        return profile;
    }

    private void validateRequest(DiscoveryRequest request) {
        if (request.rentalStartDate() != null && request.rentalEndDate() == null
            || request.rentalStartDate() == null && request.rentalEndDate() != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose both the rental start and end dates.");
        }
        if (request.rentalStartDate() != null) {
            LocalDate today = LocalDate.now(java.time.ZoneId.of("Asia/Kolkata"));
            long days = ChronoUnit.DAYS.between(request.rentalStartDate(), request.rentalEndDate());
            if (request.rentalStartDate().isBefore(today) || days < 1 || days > 30) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose future rental dates for a period of 1 to 30 days.");
            }
        }
        if (request.budgetMin() != null && request.budgetMax() != null && request.budgetMin().compareTo(request.budgetMax()) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The minimum budget cannot exceed the maximum.");
        }
        if (request.latitude() != null && (request.latitude().abs().compareTo(BigDecimal.valueOf(90)) > 0
            || request.longitude() == null || request.longitude().abs().compareTo(BigDecimal.valueOf(180)) > 0)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The approximate location is not valid.");
        }
        if (request.longitude() != null && request.latitude() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Location search needs both approximate coordinates.");
        }
        if (request.distanceKm() != null && (request.latitude() == null || request.longitude() == null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose approximate device location to filter by distance, or search by area or PIN code.");
        }
        if (request.inspirationImageData() != null && !request.inspirationImageData().isBlank()
            && !request.inspirationImageData().matches("^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Use a JPG, PNG, or WebP inspiration image.");
        }
    }

    private static void validateDates(LocalDate start, LocalDate end) {
        if (start == null && end == null) return;
        LocalDate today = LocalDate.now(java.time.ZoneId.of("Asia/Kolkata"));
        long days = start == null || end == null ? 0 : ChronoUnit.DAYS.between(start, end);
        if (start == null || end == null || start.isBefore(today) || days < 1 || days > 30) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose future rental dates for a period of 1 to 30 days.");
        }
    }

    private String validatedImage(String imageData) {
        if (imageData == null || imageData.isBlank()) return null;
        if (imageData.length() > 2_900_000) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Choose an inspiration image smaller than 2 MB.");
        return imageData;
    }

    private Map<String, Object> emptyResponse(DiscoveryRequest request, Understanding understanding, String notice) {
        return Map.ofEntries(
            Map.entry("items", List.of()), Map.entry("total", 0),
            Map.entry("limit", request.limit() == null ? 24 : request.limit()), Map.entry("offset", 0),
            Map.entry("hasMore", false), Map.entry("sort", "best-match"),
            Map.entry("aiAssisted", understanding.aiAssisted()), Map.entry("notice", notice),
            Map.entry("summary", notice), Map.entry("filters", Map.of()),
            Map.entry("sections", Map.of()), Map.entry("suggestions", List.of()));
    }

    private Match score(Map<String, Object> garment, String occasion, String category, String style, String colour,
                        String size, BigDecimal minimum, BigDecimal maximum, Integer days, LocalDate rentalStart,
                        String fulfilment, Double distance, Integer radius, Map<String, Object> preferences,
                        List<String> queryTerms, boolean hasImage, InterpretedQuery interpretation, Double mlScore) {
        List<String> reasons = new ArrayList<>();
        Map<String, Double> factors = new HashMap<>();
        String name = text(garment, "name");
        String details = (name + " " + text(garment, "category") + " " + text(garment, "designer") + " "
            + text(garment, "description") + " " + text(garment, "style") + " " + text(garment, "colour")).toLowerCase(Locale.ROOT);
        String itemOccasions = String.join(" ", array(garment.get("occasions"))).toLowerCase(Locale.ROOT);
        String garmentCategory = text(garment, "category").toLowerCase(Locale.ROOT);
        String garmentStyle = text(garment, "style").toLowerCase(Locale.ROOT);
        String garmentColour = text(garment, "colour").toLowerCase(Locale.ROOT);

        factors.put("occasion", occasion.isBlank() ? 0.5 : (itemOccasions.contains(occasion.toLowerCase(Locale.ROOT))
            || details.contains(occasion.toLowerCase(Locale.ROOT)) ? 1.0 : 0.55));
        if (!occasion.isBlank() && factors.get("occasion") >= 0.9) reasons.add("Suited to your " + occasion.toLowerCase(Locale.ROOT));
        factors.put("style", style.isBlank() ? 0.5 : matchTag(garmentStyle, details, style));
        if (!style.isBlank() && factors.get("style") >= 0.8) reasons.add("Matches your " + style.toLowerCase(Locale.ROOT) + " style");
        factors.put("colour", colour.isBlank() ? 0.5 : matchTag(garmentColour, details, colour));
        if (!colour.isBlank() && factors.get("colour") >= 0.8) reasons.add("Matches your " + colour.toLowerCase(Locale.ROOT) + " colour preference");
        factors.put("category", category.isBlank() ? 0.5 : (categoryMatches(category, garmentCategory + " " + name) ? 1.0 : 0.5));
        if (!category.isBlank()) reasons.add("Matches your selected clothing category");
        factors.put("size", size.isBlank() ? 0.5 : 1.0);
        if (!size.isBlank()) reasons.add("Your selected size is listed");
        BigDecimal price = decimal(garment.get("price"));
        BigDecimal estimatedPrice = days == null ? price : price.multiply(BigDecimal.valueOf(days))
            .divide(BigDecimal.valueOf(Math.max(1, integer(garment.get("days")))), 0, RoundingMode.CEILING);
        boolean withinBudget = (minimum == null || estimatedPrice.compareTo(minimum) >= 0)
            && (maximum == null || estimatedPrice.compareTo(maximum) <= 0);
        factors.put("budget", minimum == null && maximum == null ? 0.5 : withinBudget ? 1.0 : 0.5);
        if (maximum != null && withinBudget) reasons.add("Within your ₹" + maximum.stripTrailingZeros().toPlainString() + " budget");
        factors.put("availability", rentalStart == null ? 0.5 : 1.0);
        if (rentalStart != null) reasons.add("Available for your rental dates");
        double proximity = distance == null ? 0.5 : radius == null ? 1.0 / (1.0 + distance / 5.0) : Math.max(0, 1 - distance / radius);
        factors.put("proximity", proximity);
        if (distance != null) reasons.add("About " + BigDecimal.valueOf(distance).setScale(1, RoundingMode.HALF_UP).toPlainString() + " km away");
        factors.put("fulfilment", fulfilment.isBlank() ? 0.5 : 1.0);
        if (!fulfilment.isBlank()) reasons.add(fulfilment.equals("pickup") ? "Pickup is available" : "Delivery is available");
        double rating = decimal(garment.get("rating")).doubleValue();
        int reviewCount = integer(garment.get("reviewCount"));
        double adjustedRating = reviewCount == 0 ? 0.5 : Math.min(1, ((rating * reviewCount + 12.0) / (reviewCount + 3.0)) / 5.0);
        factors.put("reviews", adjustedRating);
        if (rating >= 4 && reviewCount >= 3) reasons.add(String.format(Locale.ROOT, "Rated %.1f from %d verified reviews", rating, reviewCount));
        factors.put("condition", conditionScore(text(garment, "condition")));
        if (conditionScore(text(garment, "condition")) >= 0.8) reasons.add("Listed in " + text(garment, "condition").toLowerCase(Locale.ROOT) + " condition");
        factors.put("personalization", preferenceScore(garment, preferences));
        int completed = integer(garment.get("completedRentals"));
        factors.put("popularity", Math.min(1.0, Math.log1p(completed) / Math.log(10)));
        if (completed >= 3) reasons.add("Rented successfully before");
        double semantic = semanticScore(details, queryTerms);
        factors.put("semantic", semantic);
        if (semantic >= 0.7 && !queryTerms.isEmpty()) reasons.add("Matches details in your search");
        double inspiration = hasImage ? 0.45 : 0.5;
        if (hasImage && (!interpretation.colour().isBlank() || !interpretation.style().isBlank() || !interpretation.category().isBlank())) {
            int matches = 0;
            int checked = 0;
            if (!interpretation.colour().isBlank()) { checked++; if (details.contains(interpretation.colour().toLowerCase(Locale.ROOT))) matches++; }
            if (!interpretation.style().isBlank()) { checked++; if (details.contains(interpretation.style().toLowerCase(Locale.ROOT))) matches++; }
            if (!interpretation.category().isBlank()) { checked++; if (categoryMatches(interpretation.category(), details)) matches++; }
            inspiration = checked == 0 ? 0.5 : 0.25 + 0.75 * matches / checked;
            if (matches > 0) reasons.add("Similar to visible attributes in your inspiration image");
        }
        factors.put("inspiration", inspiration);

        double score = factors.entrySet().stream().mapToDouble(entry -> WEIGHTS.get(entry.getKey()) * entry.getValue()).sum();
        int percent = (int) Math.round(score);
        return new Match(score, percent, reasons.stream().distinct().limit(6).toList());
    }

    private Map<String, Object> fitConfidence(Measurements measurements, String selectedSize, Map<String, Object> garment) {
        if (measurements == null || java.util.stream.Stream.of(measurements.heightCm(), measurements.chestCm(),
            measurements.waistCm(), measurements.hipCm(), measurements.shoulderCm(), measurements.inseamCm()).allMatch(java.util.Objects::isNull)) {
            if (selectedSize != null && !selectedSize.isBlank()) {
                return Map.of("level", "medium", "explanation", "Your selected size matches a listed size. Garment measurements are not available, so check with the provider before booking.");
            }
            return Map.of("level", "unavailable", "explanation", "Fit confidence unavailable — add an optional size or measurements for a closer comparison.");
        }
        Map<String, BigDecimal> user = new HashMap<>();
        user.put("heightCm", measurements.heightCm()); user.put("chestCm", measurements.chestCm());
        user.put("waistCm", measurements.waistCm()); user.put("hipCm", measurements.hipCm());
        user.put("shoulderCm", measurements.shoulderCm()); user.put("inseamCm", measurements.inseamCm());
        List<Double> differences = new ArrayList<>();
        for (Map.Entry<String, BigDecimal> entry : user.entrySet()) {
            BigDecimal theirs = entry.getValue();
            BigDecimal listed = decimalOrNull(garment.get(entry.getKey()));
            if (theirs != null && listed != null && listed.signum() > 0) {
                differences.add(theirs.subtract(listed).abs().divide(listed, 4, RoundingMode.HALF_UP).doubleValue());
            }
        }
        if (differences.isEmpty()) {
            if (selectedSize != null && !selectedSize.isBlank()) {
                return Map.of("level", "medium", "explanation", "Your selected size matches a listed size. The listing has no comparable measurements, so check with the provider before booking.");
            }
            return Map.of("level", "unavailable", "explanation", "Fit confidence unavailable — the listing has no comparable measurements.");
        }
        double worst = differences.stream().mapToDouble(Double::doubleValue).max().orElse(1);
        String level = worst <= 0.04 ? "high" : worst <= 0.10 ? "medium" : "low";
        String explanation = level.equals("high") ? "Your entered measurements are close to the seller’s listed measurements. Fit is not guaranteed."
            : level.equals("medium") ? "Some measurements are close; confirm sizing with the provider before booking."
            : "Your entered measurements differ from the listing. Ask the provider about fit before booking.";
        return Map.of("level", level, "explanation", explanation);
    }

    private static double preferenceScore(Map<String, Object> garment, Map<String, Object> preferences) {
        if (!Boolean.TRUE.equals(preferences.get("saved"))) return 0.5;
        int checked = 0;
        int matched = 0;
        String item = (text(garment, "category") + " " + text(garment, "style") + " " + text(garment, "colour") + " " + text(garment, "size")).toLowerCase(Locale.ROOT);
        for (String key : List.of("preferredCategories", "preferredStyles", "preferredColours")) {
            for (String value : array(preferences.get(key))) {
                checked++;
                if (item.contains(value.toLowerCase(Locale.ROOT))) matched++;
            }
        }
        if (preferences.get("preferredSize") != null) {
            checked++;
            if (text(garment, "size").toLowerCase(Locale.ROOT).contains(string(preferences.get("preferredSize")).toLowerCase(Locale.ROOT))) matched++;
        }
        return checked == 0 ? 0.5 : 0.35 + 0.65 * matched / checked;
    }

    private static double semanticScore(String details, List<String> terms) {
        if (terms.isEmpty()) return 0.5;
        long matched = terms.stream().filter(term -> details.contains(term.toLowerCase(Locale.ROOT))).count();
        return Math.max(0.2, Math.min(1, 0.35 + 0.65 * (double) matched / terms.size()));
    }

    private static List<String> queryTerms(String query, List<String> interpreted) {
        List<String> source = interpreted == null || interpreted.isEmpty() ? List.of() : interpreted;
        List<String> values = new ArrayList<>();
        for (String term : source) {
            if (term == null) continue;
            var matcher = WORD.matcher(term.toLowerCase(Locale.ROOT));
            while (matcher.find()) {
                String token = matcher.group();
                if (!STOP_WORDS.contains(token) && !token.matches("\\d{2,}") && !values.contains(token)) values.add(token);
            }
        }
        if (values.isEmpty() && query != null) {
            var matcher = WORD.matcher(query.toLowerCase(Locale.ROOT));
            while (matcher.find()) {
                String token = matcher.group();
                if (!STOP_WORDS.contains(token) && !token.matches("\\d{2,}") && !values.contains(token)) values.add(token);
            }
        }
        return values.stream().limit(8).toList();
    }

    private static void sort(List<Map<String, Object>> items, String mode) {
        Comparator<Map<String, Object>> byPrice = Comparator.comparing(item -> decimal(item.get("estimatedRentalPrice")));
        Comparator<Map<String, Object>> byRating = Comparator.comparingDouble(item -> decimal(garment(item).get("rating")).doubleValue());
        Comparator<Map<String, Object>> byDate = Comparator.comparing(item -> string(garment(item).get("createdAt")), Comparator.reverseOrder());
        Comparator<Map<String, Object>> byDistance = Comparator.comparing(item -> decimalOrNull(item.get("distanceKm")),
            Comparator.nullsLast(Comparator.naturalOrder()));
        switch (mode) {
            case "nearest" -> items.sort(byDistance.thenComparing(byPrice));
            case "lowest-price" -> items.sort(byPrice);
            case "highest-rated" -> items.sort(byRating.reversed().thenComparing(item -> -integer(garment(item).get("reviewCount"))));
            case "available-today" -> items.sort(byDate);
            case "new-arrivals" -> items.sort(byDate);
            default -> items.sort(Comparator.comparingDouble((Map<String, Object> item) -> decimal(item.get("score")).doubleValue()).reversed());
        }
    }

    private static Map<String, Object> sections(List<Map<String, Object>> ranked, int total) {
        List<String> nearby = ranked.stream().filter(item -> item.get("distanceKm") != null).limit(12).map(item -> string(garment(item).get("id"))).toList();
        List<String> highRated = ranked.stream().filter(item -> decimal(garment(item).get("rating")).compareTo(BigDecimal.valueOf(4)) >= 0
            && integer(garment(item).get("reviewCount")) >= 3).limit(12).map(item -> string(garment(item).get("id"))).toList();
        List<String> newArrivals = ranked.stream().sorted(Comparator.comparing(item -> string(garment(item).get("createdAt")), Comparator.reverseOrder()))
            .limit(12).map(item -> string(garment(item).get("id"))).toList();
        return Map.of("nearYou", nearby, "highlyRated", highRated, "newArrivals", newArrivals, "total", total);
    }

    private static List<String> suggestions(int total, LocalDate rentalStart, Integer distance, BigDecimal budgetMax, String area) {
        if (total > 0) return List.of();
        List<String> result = new ArrayList<>();
        if (rentalStart != null) result.add("Keep your dates fixed; try broadening a style, colour, or category preference.");
        if (distance != null) result.add("You can widen the distance radius. ReWear will keep your rental dates and budget unchanged.");
        if (budgetMax != null) result.add("You can raise the budget limit if you want to explore more listings.");
        if (area != null && !area.isBlank()) result.add("Try another locality or PIN code to see more nearby listings.");
        if (result.isEmpty()) result.add("Try a broader style or category. Your selected constraints were not changed.");
        return result;
    }

    private static String notice(String aiNotice, DiscoveryRequest request, Integer distance, BigDecimal latitude,
                                 List<Map<String, Object>> candidates, int total) {
        List<String> notices = new ArrayList<>();
        if (aiNotice != null && !aiNotice.isBlank()) notices.add(aiNotice);
        if (request.inspirationImageData() != null && !request.inspirationImageData().isBlank()
            && (aiNotice == null || aiNotice.isBlank())) {
            notices.add("Image recommendations compare broad visual attributes; they are not exact outfit matches.");
        }
        if (distance != null && latitude != null) {
            notices.add("Radius results include listings with approximate map coordinates; listings without a map point are left out.");
        }
        if (total == 0 && request.transactionType() != null && "purchase".equalsIgnoreCase(request.transactionType())) {
            notices.add("Purchase checkout is not available yet.");
        }
        return String.join(" ", notices);
    }

    private static Map<String, Object> filterSummary(String occasion, LocalDate eventDate, LocalDate start, LocalDate end,
        String category, String size, String style, String colour, BigDecimal minimum, BigDecimal maximum,
        String area, String postcode, Integer distance, String fulfilment, DiscoveryRequest request) {
        Map<String, Object> filters = new LinkedHashMap<>();
        filters.put("occasion", clean(occasion)); filters.put("eventDate", eventDate);
        filters.put("rentalStartDate", start); filters.put("rentalEndDate", end);
        filters.put("category", clean(category)); filters.put("size", clean(size));
        filters.put("style", clean(style)); filters.put("colour", clean(colour));
        filters.put("budgetMin", minimum); filters.put("budgetMax", maximum);
        filters.put("area", clean(area)); filters.put("postcode", clean(postcode));
        filters.put("distanceKm", distance); filters.put("fulfilment", clean(fulfilment));
        filters.put("condition", clean(request.condition())); filters.put("minimumRating", request.minimumRating());
        filters.put("premiumOnly", Boolean.TRUE.equals(request.premiumOnly()));
        filters.put("transactionType", "rental"); filters.put("sort", normalizeSort(request.sort()));
        return filters;
    }

    private static Map<String, Object> normalizeGarment(Map<String, Object> source) {
        Map<String, Object> result = new LinkedHashMap<>(source);
        result.put("occasions", array(source.get("occasions")));
        result.put("deliveryPostcodes", array(source.get("deliveryPostcodes")));
        return result;
    }

    private static Map<String, Object> garment(Map<String, Object> item) {
        @SuppressWarnings("unchecked")
        Map<String, Object> garment = (Map<String, Object>) item.get("garment");
        return garment;
    }

    private static double matchTag(String tag, String details, String selected) {
        if (tag.isBlank() && !details.contains(selected.toLowerCase(Locale.ROOT))) return 0.45;
        return (tag + " " + details).contains(selected.toLowerCase(Locale.ROOT)) ? 1.0 : 0.5;
    }

    private static boolean categoryMatches(String selected, String details) {
        String normalized = selected.toLowerCase(Locale.ROOT);
        if (normalized.contains("saree") || normalized.contains("sari")) return details.contains("saree") || details.contains("sari");
        if (normalized.contains("dress") || normalized.contains("gown")) return details.contains("dress") || details.contains("gown") || details.contains("anarkali");
        if (normalized.contains("suit") || normalized.contains("formal")) return details.contains("suit") || details.contains("tux") || details.contains("formal");
        if (normalized.contains("ethnic")) return details.contains("ethnic") || details.contains("lehenga") || details.contains("saree") || details.contains("kurta");
        return details.contains(normalized);
    }

    private static double conditionScore(String condition) {
        return switch (condition.toLowerCase(Locale.ROOT)) {
            case "new", "like new", "excellent" -> 1.0;
            case "very good" -> 0.85;
            case "good", "worn once" -> 0.7;
            case "fair" -> 0.45;
            default -> 0.5;
        };
    }

    private static Double distanceKm(BigDecimal userLat, BigDecimal userLon, BigDecimal productLat, BigDecimal productLon) {
        if (userLat == null || userLon == null || productLat == null || productLon == null) return null;
        double lat1 = Math.toRadians(userLat.doubleValue());
        double lat2 = Math.toRadians(productLat.doubleValue());
        double deltaLat = lat2 - lat1;
        double deltaLon = Math.toRadians(productLon.doubleValue() - userLon.doubleValue());
        double a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2)
            + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
        return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private static BigDecimal coordinate(BigDecimal value) {
        return value == null ? null : value.setScale(2, RoundingMode.HALF_UP);
    }

    private static List<String> array(Object value) {
        if (value == null) return List.of();
        if (value instanceof String[] strings) return java.util.Arrays.stream(strings).filter(item -> item != null && !item.isBlank()).toList();
        if (value instanceof java.sql.Array sqlArray) {
            try {
                Object raw = sqlArray.getArray();
                if (raw instanceof String[] strings) return java.util.Arrays.stream(strings).filter(item -> item != null && !item.isBlank()).toList();
            } catch (Exception ignored) { return List.of(); }
        }
        if (value instanceof List<?> list) return list.stream().map(String::valueOf).toList();
        return List.of(String.valueOf(value));
    }

    private static String join(List<String> values) {
        if (values == null || values.isEmpty()) return "";
        return values.stream().map(RecommendationService::clean).filter(value -> value != null).distinct()
            .limit(12).reduce((left, right) -> left + "," + right).orElse("");
    }

    private static String preferenceText(Map<String, Object> preferences, String key) {
        return firstList(preferences.get(key));
    }

    private static String firstList(Object values) {
        List<String> list = array(values);
        return list.isEmpty() ? "" : list.getFirst();
    }

    private static String normalizeFulfilment(String value) {
        if (value == null || value.isBlank()) return null;
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        if (!List.of("pickup", "delivery").contains(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose pickup or delivery.");
        }
        return normalized;
    }

    private static String normalizeSort(String value) {
        if (value == null || value.isBlank()) return "best-match";
        String normalized = value.trim().toLowerCase(Locale.ROOT).replace('_', '-').replace(' ', '-');
        if (!List.of("best-match", "nearest", "lowest-price", "highest-rated", "available-today", "new-arrivals").contains(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a supported sort order.");
        }
        return normalized;
    }

    private static String first(String preferred, String parsed, String fallback) {
        if (preferred != null && !preferred.isBlank()) return preferred.trim();
        if (parsed != null && !parsed.isBlank()) return parsed.trim();
        return fallback == null ? "" : fallback.trim();
    }

    private static BigDecimal first(BigDecimal preferred, BigDecimal parsed, BigDecimal fallback) {
        return preferred != null ? preferred : parsed != null ? parsed : fallback;
    }

    private static Integer first(Integer preferred, Integer parsed) {
        return preferred != null ? preferred : parsed;
    }

    private static LocalDate first(LocalDate preferred, LocalDate parsed) {
        return preferred != null ? preferred : parsed;
    }

    private static BigDecimal decimal(String value) {
        if (value == null || value.isBlank()) return null;
        try { return new BigDecimal(value); } catch (Exception ignored) { return null; }
    }

    private static BigDecimal decimal(Object value) {
        if (value == null) return BigDecimal.ZERO;
        if (value instanceof BigDecimal number) return number;
        try { return new BigDecimal(value.toString()); } catch (Exception ignored) { return BigDecimal.ZERO; }
    }

    private static BigDecimal decimalOrNull(Object value) {
        if (value == null) return null;
        if (value instanceof BigDecimal number) return number;
        try { return new BigDecimal(value.toString()); } catch (Exception ignored) { return null; }
    }

    private static LocalDate date(String value) {
        if (value == null || value.isBlank()) return null;
        try { return LocalDate.parse(value); } catch (Exception ignored) { return null; }
    }

    private static Integer integer(String value) {
        if (value == null || value.isBlank()) return null;
        try { return Integer.valueOf(value); } catch (Exception ignored) { return null; }
    }

    private static int integer(Object value) {
        if (value == null) return 0;
        if (value instanceof Number number) return number.intValue();
        try { return Integer.parseInt(value.toString()); } catch (Exception ignored) { return 0; }
    }

    private static String text(Map<String, Object> map, String key) {
        return map.get(key) == null ? "" : String.valueOf(map.get(key));
    }

    private static String string(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private static String clean(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static Map<String, Object> filterSummary(DiscoveryRequest request) {
        return Map.of("transactionType", string(request.transactionType()));
    }

    private record Match(double score, int percent, List<String> reasons) {}
}


