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

    public List<Map<String, Object>> browse(String query, String category, String size, Integer maxPrice, Integer limit, Integer offset) {
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
        sql.append(" ORDER BY g.created_at DESC LIMIT :limit OFFSET :offset");
        params.addValue("limit", Math.min(limit != null ? limit : 50, 100));
        params.addValue("offset", offset != null ? offset : 0);
        return withArrayFields(jdbc.queryForList(sql.toString(), params));
    }

    public List<Map<String, Object>> discoveryCandidates(DiscoveryCriteria criteria) {
        StringBuilder sql = new StringBuilder(SELECT_WITH_INSIGHTS)
            .append(" WHERE g.active = true AND g.under_maintenance = false AND g.retired_at IS NULL");
        MapSqlParameterSource params = new MapSqlParameterSource();
        
        
        
        
        
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
        sql.append(" ORDER BY g.created_at DESC LIMIT :candidateLimit OFFSET :candidateOffset");
        params.addValue("candidateLimit", Math.max(criteria.limit() + criteria.offset(), 240))
            .addValue("candidateOffset", 0);
        return jdbc.queryForList(sql.toString(), params);
    }

    private static List<String> parseArray(Object raw) {
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


