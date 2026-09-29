package com.rewear.api.garment;

import java.sql.Types;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.rewear.api.profile.ProfileDtos.ProfileResponse;
import com.rewear.api.profile.ProfileService;
import com.rewear.api.garment.GarmentDtos.SaveRequest;
import com.rewear.api.garment.GarmentDtos.DiscoveryCriteria;
import com.rewear.api.garment.GarmentDtos.LifecycleRequest;

@Service
public class GarmentService {
    private static final String SELECT_WITH_INSIGHTS = """
        SELECT g.id, g.owner_id AS "ownerId", g.owner_type AS "ownerType", g.owner_name AS "ownerName",
               g.name, g.designer, g.category, g.condition, g.description,
               g.rental_price AS price, g.retail_value AS mrp, g.deposit_amount AS "depositAmount",
               g.stock_quantity AS quantity,
               g.size, g.fit_match AS "fitMatch", g.location AS distance,
               g.care_instructions AS "careInstructions", g.badge_color AS "badgeColor",
               COALESCE(g.image_url, g.image_path) AS image, g.active AND NOT g.under_maintenance AND g.retired_at IS NULL AS available,
               g.style_tag AS style, g.colour_tag AS colour, g.occasions,
               g.pickup_available AS "pickupAvailable", g.delivery_available AS "deliveryAvailable",
               g.delivery_postcodes AS "deliveryPostcodes", g.public_latitude AS "approximateLatitude",
               g.public_longitude AS "approximateLongitude", g.height_cm AS "heightCm", g.chest_cm AS "chestCm",
               g.waist_cm AS "waistCm", g.hip_cm AS "hipCm", g.shoulder_cm AS "shoulderCm",
               g.inseam_cm AS "inseamCm", g.under_maintenance AS "underMaintenance",
               (g.retired_at IS NOT NULL) AS retired,
               g.created_at AS "createdAt",
               COALESCE(activity.completed_rentals, 0) AS "completedRentals",
               COALESCE(activity.total_rental_days, 0) AS "totalRentalDays",
               COALESCE(activity.recorded_custody_days, 0) AS "recordedCustodyDays",
               activity.last_rented_at AS "lastRentedAt",
               reviews.rating, COALESCE(reviews.review_count, 0) AS "reviewCount"
        FROM garments g
        LEFT JOIN LATERAL (
            SELECT count(*) AS completed_rentals,
                   COALESCE(sum(b.rental_days), 0) AS total_rental_days,
                   COALESCE(sum(CASE WHEN b.picked_up_at IS NOT NULL AND b.returned_at IS NOT NULL
                       THEN GREATEST(1, ceil(extract(epoch FROM (b.returned_at - b.picked_up_at)) / 86400)::int)
                       ELSE 0 END), 0) AS recorded_custody_days,
                   max(b.completed_at) AS last_rented_at
            FROM bookings b
            WHERE b.garment_id = g.id AND b.status = 'completed'
        ) activity ON true
        LEFT JOIN LATERAL (
            SELECT round(avg(r.rating)::numeric, 1) AS rating, count(*) AS review_count
            FROM reviews r
            WHERE r.garment_id = g.id AND r.visibility = 'visible'
        ) reviews ON true
        """;

    private final NamedParameterJdbcTemplate jdbc;
    private final ProfileService profiles;

    public GarmentService(NamedParameterJdbcTemplate jdbc, ProfileService profiles) {
        this.jdbc = jdbc;
        this.profiles = profiles;
    }

    public List<Map<String, Object>> browse(String query, String category, String size, Integer maxPrice) {
        StringBuilder sql = new StringBuilder(SELECT_WITH_INSIGHTS)
            .append(" WHERE g.active = true AND g.under_maintenance = false AND g.retired_at IS NULL");
        MapSqlParameterSource params = new MapSqlParameterSource();
        if (query != null && !query.isBlank()) {
            sql.append(" AND (g.name ILIKE :query OR g.designer ILIKE :query OR g.description ILIKE :query OR g.category ILIKE :query)");
            params.addValue("query", "%" + query.trim() + "%");
        }
        if (category != null && !category.isBlank()) {
            sql.append(" AND g.category ILIKE :category");
            params.addValue("category", "%" + category.trim() + "%");
        }
        if (size != null && !size.isBlank()) {
            sql.append(" AND g.size ILIKE :size");
            params.addValue("size", size.trim());
        }
        if (maxPrice != null && maxPrice > 0) {
            sql.append(" AND g.rental_price <= :maxPrice");
            params.addValue("maxPrice", maxPrice);
        }
        sql.append(" ORDER BY g.created_at DESC");
        return withArrayFields(jdbc.queryForList(sql.toString(), params));
    }

    public List<Map<String, Object>> discoveryCandidates(DiscoveryCriteria criteria) {
        StringBuilder sql = new StringBuilder(SELECT_WITH_INSIGHTS)
            .append(" WHERE g.active = true AND g.under_maintenance = false AND g.retired_at IS NULL");
        MapSqlParameterSource params = new MapSqlParameterSource();
        if (criteria.category() != null && !criteria.category().isBlank()) {
            sql.append(" AND ").append(categoryPredicate(criteria.category()));
            params.addValue("category", "%" + criteria.category().trim() + "%");
        }
        if (criteria.size() != null && !criteria.size().isBlank()) {
            sql.append(" AND g.size ILIKE :size");
            params.addValue("size", "%" + criteria.size().trim() + "%");
        }
        if (criteria.style() != null && !criteria.style().isBlank()) {
            sql.append(" AND (g.style_tag ILIKE :style OR g.name ILIKE :style OR g.description ILIKE :style)");
            params.addValue("style", "%" + criteria.style().trim() + "%");
        }
        if (criteria.colour() != null && !criteria.colour().isBlank()) {
            sql.append(" AND (g.colour_tag ILIKE :colour OR g.name ILIKE :colour OR g.description ILIKE :colour)");
            params.addValue("colour", "%" + criteria.colour().trim() + "%");
        }
        if (criteria.occasion() != null && !criteria.occasion().isBlank()) {
            sql.append(" AND (cardinality(g.occasions) = 0 OR EXISTS (SELECT 1 FROM unnest(g.occasions) o WHERE o ILIKE :occasion))");
            params.addValue("occasion", criteria.occasion().trim());
        }
        if (criteria.rentalStart() != null && criteria.rentalEnd() != null) {
            sql.append(" AND (SELECT COALESCE(MAX((SELECT count(*) FROM bookings b WHERE b.garment_id = g.id ")
                .append("AND b.status IN ('requested', 'confirmed', 'in_use', 'return_pending') ")
                .append("AND daterange(b.pickup_date, b.return_date, '[]') @> candidate.rental_day)), 0) ")
                .append("FROM (SELECT CAST(:rentalStart AS date) AS rental_day UNION ")
                .append("SELECT b.pickup_date FROM bookings b WHERE b.garment_id = g.id ")
                .append("AND b.status IN ('requested', 'confirmed', 'in_use', 'return_pending') ")
                .append("AND b.pickup_date BETWEEN :rentalStart AND :rentalEnd ")
                .append("AND daterange(b.pickup_date, b.return_date, '[]') && daterange(:rentalStart, :rentalEnd, '[]')) candidate) < g.stock_quantity");
            params.addValue("rentalStart", criteria.rentalStart()).addValue("rentalEnd", criteria.rentalEnd());
        }
        if (criteria.budgetMin() != null || criteria.budgetMax() != null) {
            String price = criteria.rentalDays() != null && criteria.rentalDays() > 0
                ? "ceil(g.rental_price * :rentalDays)" : "g.rental_price";
            if (criteria.rentalDays() != null && criteria.rentalDays() > 0) params.addValue("rentalDays", criteria.rentalDays());
            if (criteria.budgetMin() != null) {
                sql.append(" AND ").append(price).append(" >= :budgetMin");
                params.addValue("budgetMin", criteria.budgetMin());
            }
            if (criteria.budgetMax() != null) {
                sql.append(" AND ").append(price).append(" <= :budgetMax");
                params.addValue("budgetMax", criteria.budgetMax());
            }
        }
        if (criteria.area() != null && !criteria.area().isBlank()) {
            sql.append(" AND g.location ILIKE :area");
            params.addValue("area", "%" + criteria.area().trim() + "%");
        }
        if (criteria.postcode() != null && !criteria.postcode().isBlank()) {
            if ("pickup".equals(criteria.fulfilment())) {
                sql.append(" AND g.location ILIKE :postcodeLike");
                params.addValue("postcodeLike", "%" + criteria.postcode().trim() + "%");
            } else if (criteria.fulfilment() == null || criteria.fulfilment().isBlank()) {
                sql.append(" AND (g.location ILIKE :postcodeLike OR (g.delivery_available = true AND :postcodeExact = ANY(g.delivery_postcodes)))");
                params.addValue("postcodeLike", "%" + criteria.postcode().trim() + "%");
                params.addValue("postcodeExact", criteria.postcode().trim());
            }
        }
        if ("pickup".equals(criteria.fulfilment())) sql.append(" AND g.pickup_available = true");
        if ("delivery".equals(criteria.fulfilment())) {
            sql.append(" AND g.delivery_available = true");
            if (criteria.postcode() != null && !criteria.postcode().isBlank()) {
                sql.append(" AND (:deliveryPostcode = ANY(g.delivery_postcodes) OR (cardinality(g.delivery_postcodes) = 0 AND g.location ILIKE :deliveryArea))");
                params.addValue("deliveryPostcode", criteria.postcode().trim())
                    .addValue("deliveryArea", criteria.area() == null || criteria.area().isBlank()
                        ? "__no_area_match__" : "%" + criteria.area().trim() + "%");
            }
        }
        if (criteria.condition() != null && !criteria.condition().isBlank()) {
            sql.append(" AND lower(g.condition) = lower(:condition)");
            params.addValue("condition", criteria.condition().trim());
        }
        if (criteria.minimumRating() != null && criteria.minimumRating().signum() > 0) {
            sql.append(" AND COALESCE(reviews.rating, 0) >= :minimumRating");
            params.addValue("minimumRating", criteria.minimumRating());
        }
        if (Boolean.TRUE.equals(criteria.premiumOnly())) sql.append(" AND g.retail_value >= 15000");
        if (criteria.radiusKm() != null && criteria.latitude() != null && criteria.longitude() != null) {
            sql.append(" AND g.public_latitude IS NOT NULL AND g.public_longitude IS NOT NULL ")
                .append("AND 6371 * acos(LEAST(1, GREATEST(-1, ")
                .append("sin(radians(:latitude)) * sin(radians(g.public_latitude)) + ")
                .append("cos(radians(:latitude)) * cos(radians(g.public_latitude)) * ")
                .append("cos(radians(g.public_longitude) - radians(:longitude))))) <= :radiusKm");
            params.addValue("latitude", criteria.latitude()).addValue("longitude", criteria.longitude())
                .addValue("radiusKm", criteria.radiusKm());
        }
        sql.append(" ORDER BY g.created_at DESC LIMIT :candidateLimit OFFSET :candidateOffset");
        params.addValue("candidateLimit", Math.max(criteria.limit() + criteria.offset(), 240))
            .addValue("candidateOffset", 0);
        return jdbc.queryForList(sql.toString(), params);
    }

    private static String categoryPredicate(String category) {
        return switch (category.trim().toLowerCase()) {
            case "dress", "dresses", "gown", "gowns" -> "(g.category ILIKE '%dress%' OR g.category ILIKE '%gown%' OR g.name ILIKE '%dress%' OR g.name ILIKE '%gown%' OR g.name ILIKE '%anarkali%')";
            case "blazer", "blazers" -> "(g.category ILIKE '%blazer%' OR g.name ILIKE '%blazer%')";
            case "suit", "suits", "formal wear" -> "(g.category ILIKE '%suit%' OR g.category ILIKE '%formal%' OR g.name ILIKE '%suit%' OR g.name ILIKE '%tux%')";
            case "saree", "sarees", "sari" -> "(g.category ILIKE '%saree%' OR g.category ILIKE '%sari%' OR g.name ILIKE '%saree%' OR g.name ILIKE '%sari%')";
            case "kurta", "kurtas" -> "(g.category ILIKE '%kurta%' OR g.name ILIKE '%kurta%')";
            case "ethnic wear" -> "(g.category ILIKE '%ethnic%' OR g.category ILIKE '%lehenga%' OR g.category ILIKE '%saree%' OR g.category ILIKE '%kurta%')";
            case "trousers" -> "(g.category ILIKE '%trouser%' OR g.name ILIKE '%trouser%')";
            case "jacket", "jackets" -> "(g.category ILIKE '%jacket%' OR g.name ILIKE '%jacket%')";
            case "shirts" -> "(g.category ILIKE '%shirt%' OR g.name ILIKE '%shirt%')";
            case "accessories" -> "(g.category ILIKE '%accessor%' OR g.name ILIKE '%accessor%')";
            default -> "(g.category ILIKE :category OR g.name ILIKE :category)";
        };
    }

    public Map<String, Object> get(UUID garmentId) {
        List<Map<String, Object>> results = jdbc.queryForList(
            SELECT_WITH_INSIGHTS + " WHERE g.id = :id AND g.active = true AND g.under_maintenance = false AND g.retired_at IS NULL", Map.of("id", garmentId));
        if (results.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "This clothing listing is not available.");
        return withArrayFields(results).getFirst();
    }

    public List<Map<String, Object>> mine(Jwt jwt) {
        ProfileResponse profile = profiles.get(jwt);
        return withArrayFields(jdbc.queryForList(SELECT_WITH_INSIGHTS + " WHERE g.owner_id = :ownerId ORDER BY g.created_at DESC",
            Map.of("ownerId", UUID.fromString(profile.id()))));
    }

    public List<String> savedIds(Jwt jwt) {
        UUID profileId = UUID.fromString(profiles.get(jwt).id());
        return jdbc.queryForList("SELECT garment_id::text FROM saved_garments WHERE profile_id = :profileId ORDER BY created_at DESC",
            Map.of("profileId", profileId), String.class);
    }

    @Transactional
    public void save(Jwt jwt, UUID garmentId) {
        UUID profileId = UUID.fromString(profiles.get(jwt).id());
        Integer active = jdbc.queryForObject("SELECT count(*) FROM garments WHERE id=:id AND active AND NOT under_maintenance AND retired_at IS NULL",
            Map.of("id", garmentId), Integer.class);
        if (active == null || active == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "This listing is not available to save.");
        jdbc.update("INSERT INTO saved_garments(profile_id, garment_id) VALUES (:profileId, :garmentId) ON CONFLICT DO NOTHING",
            Map.of("profileId", profileId, "garmentId", garmentId));
    }

    @Transactional
    public void unsave(Jwt jwt, UUID garmentId) {
        UUID profileId = UUID.fromString(profiles.get(jwt).id());
        jdbc.update("DELETE FROM saved_garments WHERE profile_id=:profileId AND garment_id=:garmentId",
            Map.of("profileId", profileId, "garmentId", garmentId));
    }

    @Transactional
    public Map<String, Object> create(Jwt jwt, SaveRequest request) {
        ProfileResponse profile = profiles.get(jwt);
        validateSizes(profile, request);
        validateApproximateLocation(request);
        validatePublicArea(request.distance());
        String image = clean(request.image());
        if (image != null && image.startsWith("data:")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Upload the photo first and submit its storage URL.");
        }
        UUID id = UUID.randomUUID();
        MapSqlParameterSource parameters = new MapSqlParameterSource()
            .addValue("id", id)
            .addValue("ownerId", UUID.fromString(profile.id()))
            .addValue("ownerType", profile.role())
            .addValue("ownerName", profile.businessName() == null ? profile.name() : profile.businessName())
            .addValue("name", request.name().trim())
            .addValue("designer", defaultTo(request.designer(), profile.businessName() == null ? profile.name() : profile.businessName()))
            .addValue("category", request.category().trim())
            .addValue("condition", request.condition().trim())
            .addValue("description", clean(request.description()))
            .addValue("price", request.price())
            .addValue("mrp", request.mrp() == null ? request.price() : request.mrp())
            .addValue("size", request.size().trim())
            .addValue("fitMatch", clean(request.fitMatch()))
            .addValue("location", request.distance().trim())
            .addValue("careInstructions", clean(request.careInstructions()))
            .addValue("image", image)
            .addValue("style", clean(request.style()))
            .addValue("colour", clean(request.colour()))
            .addValue("occasions", joinList(request.occasions()))
            .addValue("pickupAvailable", request.pickupAvailable() == null || request.pickupAvailable())
            .addValue("deliveryAvailable", Boolean.TRUE.equals(request.deliveryAvailable()))
            .addValue("deliveryPostcodes", joinList(request.deliveryPostcodes()))
            .addValue("latitude", coordinate(request.approximateLatitude()))
            .addValue("longitude", coordinate(request.approximateLongitude()))
            .addValue("heightCm", request.heightCm())
            .addValue("chestCm", request.chestCm())
            .addValue("waistCm", request.waistCm())
            .addValue("hipCm", request.hipCm())
            .addValue("shoulderCm", request.shoulderCm())
            .addValue("inseamCm", request.inseamCm());
        jdbc.update("""
            INSERT INTO garments (id, owner_id, owner_type, owner_name, name, designer, category, condition,
                description, rental_price, retail_value, deposit_amount, stock_quantity, size, fit_match, location,
                care_instructions, badge_color, image_url, style_tag, colour_tag, occasions,
                pickup_available, delivery_available, delivery_postcodes, public_latitude, public_longitude,
                height_cm, chest_cm, waist_cm, hip_cm, shoulder_cm, inseam_cm, active)
            VALUES (:id, :ownerId, :ownerType, :ownerName, :name, :designer, :category, :condition,
                :description, :price, :mrp, :depositAmount, :quantity, :size, :fitMatch, :location,
                :careInstructions, 'secondary', :image, :style, :colour, string_to_array(:occasions, ','),
                :pickupAvailable, :deliveryAvailable, string_to_array(:deliveryPostcodes, ','), :latitude, :longitude,
                :heightCm, :chestCm, :waistCm, :hipCm, :shoulderCm, :inseamCm, true)
            """, parameters);
        return getOwned(id, UUID.fromString(profile.id()));
    }

    @Transactional
    public Map<String, Object> update(Jwt jwt, UUID id, SaveRequest request) {
        ProfileResponse profile = profiles.get(jwt);
        jdbc.queryForList("SELECT id FROM garments WHERE id = :id AND owner_id = :ownerId FOR UPDATE",
            Map.of("id", id, "ownerId", UUID.fromString(profile.id())));
        validateSizes(profile, request);
        validateApproximateLocation(request);
        validatePublicArea(request.distance());
        String image = clean(request.image());
        if (image != null && image.startsWith("data:")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Upload the photo first and submit its storage URL.");
        }
        validateStockQuantity(id, request.quantity() == null ? 1 : request.quantity());
        int changed = jdbc.update("""
            UPDATE garments SET name = :name, designer = :designer, category = :category, condition = :condition,
                description = :description, rental_price = :price, retail_value = :mrp, deposit_amount = :depositAmount, stock_quantity = :quantity,
                size = :size, fit_match = :fitMatch, location = :location, care_instructions = :careInstructions,
                image_url = :image, style_tag = :style, colour_tag = :colour,
                occasions = string_to_array(:occasions, ','), pickup_available = :pickupAvailable,
                delivery_available = :deliveryAvailable, delivery_postcodes = string_to_array(:deliveryPostcodes, ','),
                public_latitude = :latitude, public_longitude = :longitude,
                height_cm = :heightCm, chest_cm = :chestCm, waist_cm = :waistCm, hip_cm = :hipCm,
                shoulder_cm = :shoulderCm, inseam_cm = :inseamCm, updated_at = now()
            WHERE id = :id AND owner_id = :ownerId AND active = true
            """, saveParams(profile, id, request, image));
        if (changed == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "This listing could not be found in your wardrobe.");
        return getOwned(id, UUID.fromString(profile.id()));
    }

    private void validateStockQuantity(UUID id, int quantity) {
        Integer peakReservations = jdbc.queryForObject("""
            SELECT COALESCE(MAX((
                SELECT count(*) FROM bookings b
                WHERE b.garment_id = :id
                  AND b.status IN ('requested', 'confirmed', 'in_use', 'return_pending')
                  AND daterange(b.pickup_date, b.return_date, '[]') @> dates.rental_day
            )), 0)
            FROM (SELECT DISTINCT pickup_date AS rental_day FROM bookings
                  WHERE garment_id = :id
                    AND status IN ('requested', 'confirmed', 'in_use', 'return_pending')) dates
            """, Map.of("id", id), Integer.class);
        if (peakReservations != null && peakReservations > quantity) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Stock cannot be reduced below the number of pieces already reserved for overlapping dates.");
        }
    }

    @Transactional
    public void setAvailability(Jwt jwt, UUID id, boolean available) {
        ProfileResponse profile = profiles.get(jwt);
        int changed = jdbc.update("UPDATE garments SET active = :active, updated_at = now() WHERE id = :id AND owner_id = :ownerId",
            Map.of("active", available, "id", id, "ownerId", UUID.fromString(profile.id())));
        if (changed == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "This listing could not be found in your wardrobe.");
    }

    @Transactional
    public Map<String, Object> updateLifecycle(Jwt jwt, UUID id, LifecycleRequest request) {
        ProfileResponse profile = profiles.get(jwt);
        UUID ownerId = UUID.fromString(profile.id());
        Map<String, Object> row;
        try {
            row = jdbc.queryForMap("""
                SELECT condition, under_maintenance AS \"underMaintenance\", retired_at IS NOT NULL AS retired
                FROM garments WHERE id = :id AND owner_id = :ownerId FOR UPDATE
                """, Map.of("id", id, "ownerId", ownerId));
        } catch (org.springframework.dao.EmptyResultDataAccessException missing) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "This listing could not be found in your wardrobe.");
        }

        String previousCondition = String.valueOf(row.get("condition"));
        String nextCondition = clean(request.condition());
        boolean wasMaintained = Boolean.TRUE.equals(row.get("underMaintenance"));
        boolean wasRetired = Boolean.TRUE.equals(row.get("retired"));
        boolean changedCondition = nextCondition != null && !nextCondition.equalsIgnoreCase(previousCondition);
        boolean changedMaintenance = request.underMaintenance() != null && request.underMaintenance() != wasMaintained;
        boolean changedRetired = request.retired() != null && request.retired() != wasRetired;
        String repairNote = clean(request.repairNote());
        if (!changedCondition && !changedMaintenance && !changedRetired && repairNote == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Make a lifecycle change or add a repair note.");
        }

        if (nextCondition != null && nextCondition.length() > 24) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Condition must be 24 characters or fewer.");
        }
        jdbc.update("""
            UPDATE garments SET condition = COALESCE(:condition, condition),
                under_maintenance = COALESCE(:underMaintenance, under_maintenance),
                retired_at = CASE WHEN :retired IS NULL THEN retired_at
                    WHEN :retired THEN COALESCE(retired_at, now()) ELSE NULL END,
                updated_at = now()
            WHERE id = :id AND owner_id = :ownerId
            """, new MapSqlParameterSource()
                .addValue("condition", nextCondition, Types.VARCHAR)
                .addValue("underMaintenance", request.underMaintenance(), Types.BOOLEAN)
                .addValue("retired", request.retired(), Types.BOOLEAN)
                .addValue("id", id)
                .addValue("ownerId", ownerId));

        if (changedCondition) recordLifecycle(id, ownerId, "condition_updated", previousCondition, nextCondition, repairNote);
        if (changedMaintenance) recordLifecycle(id, ownerId,
            request.underMaintenance() ? "maintenance_started" : "maintenance_completed", previousCondition, nextCondition, repairNote);
        if (changedRetired) recordLifecycle(id, ownerId,
            request.retired() ? "retired" : "reactivated", previousCondition, nextCondition, repairNote);
        if (repairNote != null) recordLifecycle(id, ownerId, "repair_recorded", previousCondition, nextCondition, repairNote);
        return getOwned(id, ownerId);
    }

    public List<Map<String, Object>> lifecycleHistory(Jwt jwt, UUID id) {
        ProfileResponse profile = profiles.get(jwt);
        UUID ownerId = UUID.fromString(profile.id());
        if (jdbc.queryForList("SELECT id FROM garments WHERE id = :id AND owner_id = :ownerId", Map.of("id", id, "ownerId", ownerId)).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "This listing could not be found in your wardrobe.");
        }
        return jdbc.queryForList("""
            SELECT id, event_type AS \"eventType\", previous_condition AS \"previousCondition\",
                   next_condition AS \"nextCondition\", note, created_at AS \"createdAt\"
            FROM garment_lifecycle_events WHERE garment_id = :id
            ORDER BY created_at DESC LIMIT 50
            """, Map.of("id", id));
    }

    private void recordLifecycle(UUID garmentId, UUID ownerId, String eventType, String previousCondition,
                                 String nextCondition, String note) {
        jdbc.update("""
            INSERT INTO garment_lifecycle_events (garment_id, actor_id, event_type, previous_condition, next_condition, note)
            VALUES (:garmentId, :actorId, :eventType, :previousCondition, :nextCondition, :note)
            """, new MapSqlParameterSource()
                .addValue("garmentId", garmentId).addValue("actorId", ownerId).addValue("eventType", eventType)
                .addValue("previousCondition", previousCondition, Types.VARCHAR)
                .addValue("nextCondition", nextCondition, Types.VARCHAR)
                .addValue("note", note, Types.VARCHAR));
    }

    private Map<String, Object> getOwned(UUID id, UUID ownerId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            SELECT_WITH_INSIGHTS + " WHERE g.id = :id AND g.owner_id = :ownerId", Map.of("id", id, "ownerId", ownerId));
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "This listing could not be found.");
        return withArrayFields(rows).getFirst();
    }

    private static List<Map<String, Object>> withArrayFields(List<Map<String, Object>> rows) {
        return rows.stream().map(row -> {
            Map<String, Object> result = new java.util.LinkedHashMap<>(row);
            result.put("occasions", stringArray(row.get("occasions")));
            result.put("deliveryPostcodes", stringArray(row.get("deliveryPostcodes")));
            return result;
        }).toList();
    }

    private static List<String> stringArray(Object value) {
        if (value == null) return List.of();
        Object raw = value;
        if (value instanceof java.sql.Array sqlArray) {
            try {
                raw = sqlArray.getArray();
            } catch (java.sql.SQLException ignored) {
                return List.of();
            } finally {
                try { sqlArray.free(); } catch (java.sql.SQLException ignored) {}
            }
        }
        if (raw instanceof String[] strings) {
            return java.util.Arrays.stream(strings).filter(item -> item != null && !item.isBlank()).toList();
        }
        if (raw instanceof Object[] values) {
            return java.util.Arrays.stream(values).map(String::valueOf).filter(item -> !item.isBlank()).toList();
        }
        if (raw instanceof List<?> values) {
            return values.stream().map(String::valueOf).filter(item -> !item.isBlank()).toList();
        }
        return List.of();
    }

    private MapSqlParameterSource saveParams(ProfileResponse profile, UUID id, SaveRequest request, String image) {
        return new MapSqlParameterSource()
            .addValue("id", id)
            .addValue("ownerId", UUID.fromString(profile.id()))
            .addValue("name", request.name().trim())
            .addValue("designer", defaultTo(request.designer(), profile.businessName() == null ? profile.name() : profile.businessName()))
            .addValue("category", request.category().trim())
            .addValue("condition", request.condition().trim())
            .addValue("description", clean(request.description()))
            .addValue("price", request.price())
            .addValue("mrp", request.mrp() == null ? request.price() : request.mrp())
            .addValue("depositAmount", request.depositAmount() == null ? java.math.BigDecimal.ZERO : request.depositAmount())
            .addValue("quantity", request.quantity() == null ? 1 : request.quantity())
            .addValue("size", request.size().trim())
            .addValue("fitMatch", clean(request.fitMatch()))
            .addValue("location", request.distance().trim())
            .addValue("careInstructions", clean(request.careInstructions()))
            .addValue("image", image)
            .addValue("style", clean(request.style()))
            .addValue("colour", clean(request.colour()))
            .addValue("occasions", joinList(request.occasions()))
            .addValue("pickupAvailable", request.pickupAvailable() == null || request.pickupAvailable())
            .addValue("deliveryAvailable", Boolean.TRUE.equals(request.deliveryAvailable()))
            .addValue("deliveryPostcodes", joinList(request.deliveryPostcodes()))
            .addValue("latitude", coordinate(request.approximateLatitude()))
            .addValue("longitude", coordinate(request.approximateLongitude()))
            .addValue("heightCm", request.heightCm())
            .addValue("chestCm", request.chestCm())
            .addValue("waistCm", request.waistCm())
            .addValue("hipCm", request.hipCm())
            .addValue("shoulderCm", request.shoulderCm())
            .addValue("inseamCm", request.inseamCm());
    }

    private static String clean(String value) {
        if (value == null) return null;
        String cleaned = value.trim();
        return cleaned.isEmpty() ? null : cleaned;
    }

    private static String defaultTo(String value, String fallback) {
        String cleaned = clean(value);
        return cleaned == null ? fallback : cleaned;
    }

    private static String joinList(List<String> values) {
        if (values == null || values.isEmpty()) return "";
        return values.stream().map(GarmentService::clean).filter(value -> value != null)
            .distinct().limit(100).reduce((left, right) -> left + "," + right).orElse("");
    }

    private static java.math.BigDecimal coordinate(java.math.BigDecimal value) {
        return value == null ? null : value.setScale(2, java.math.RoundingMode.HALF_UP);
    }

    private static void validateApproximateLocation(SaveRequest request) {
        if ((request.approximateLatitude() == null) != (request.approximateLongitude() == null)) {
            throw new IllegalArgumentException("Provide both approximate map coordinates or leave both blank.");
        }
        if (request.approximateLatitude() != null && (request.approximateLatitude().abs().compareTo(java.math.BigDecimal.valueOf(90)) > 0
            || request.approximateLongitude().abs().compareTo(java.math.BigDecimal.valueOf(180)) > 0)) {
            throw new IllegalArgumentException("The approximate map location is not valid.");
        }
    }

    private static void validateSizes(ProfileResponse profile, SaveRequest request) {
        long sizeCount = java.util.Arrays.stream(request.size().split(",")).map(String::trim).filter(value -> !value.isBlank()).count();
        if (sizeCount == 0 || ("personal".equals(profile.role()) && sizeCount != 1)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Personal listings must have exactly one size; business listings must have at least one.");
        }
    }

    private static void validatePublicArea(String area) {
        if (area != null && area.matches("(?i).*\\b(?:flat|apartment|apt|house|door\\s*(?:no|number)?|plot|unit)\\s*[:#-]?\\s*\\d+.*|.*#\\s*\\d+.*")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Use a neighborhood or public pickup area, not a home or street address.");
        }
    }
}
