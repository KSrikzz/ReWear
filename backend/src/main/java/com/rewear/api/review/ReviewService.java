package com.rewear.api.review;

import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.rewear.api.booking.BookingDtos.ReviewRequest;
import com.rewear.api.profile.ProfileDtos.ProfileResponse;
import com.rewear.api.profile.ProfileService;

@Service
public class ReviewService {
    private final NamedParameterJdbcTemplate jdbc;
    private final ProfileService profiles;

    public ReviewService(NamedParameterJdbcTemplate jdbc, ProfileService profiles) {
        this.jdbc = jdbc;
        this.profiles = profiles;
    }

    public List<Map<String, Object>> forGarment(UUID garmentId, Integer rating, String sort, boolean withImages, Jwt jwt) {
        if (rating != null && (rating < 1 || rating > 5)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a review rating from 1 to 5.");
        }
        String order = switch (sort == null ? "recent" : sort.trim().toLowerCase()) {
            case "helpful" -> "helpful_count DESC, r.created_at DESC";
            case "highest-rated" -> "r.rating DESC, r.created_at DESC";
            case "lowest-rated" -> "r.rating ASC, r.created_at DESC";
            case "recent", "" -> "r.created_at DESC";
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a supported review sort order.");
        };
        UUID viewerId = jwt == null ? null : UUID.fromString(profiles.get(jwt).id());
        List<Map<String, Object>> rows = jdbc.queryForList("""
            SELECT r.id, r.booking_id AS "bookingId", r.garment_id AS "garmentId",
                   r.customer_id AS "customerId", r.customer_name_snapshot AS "customerName",
                   r.rating, r.fit, r.condition, r.comment, r.image_paths AS "imagePaths",
                   r.created_at AS "createdAt", true AS "verifiedRental",
                   COALESCE(votes.helpful_count, 0) AS "helpfulCount", (mine.profile_id IS NOT NULL) AS "helpfulByMe"
            FROM reviews r
            LEFT JOIN (SELECT review_id, count(*) AS helpful_count FROM review_helpful_votes GROUP BY review_id) votes
                ON votes.review_id = r.id
            LEFT JOIN review_helpful_votes mine ON mine.review_id = r.id AND mine.profile_id = :viewerId
            WHERE r.garment_id = :garmentId AND r.visibility = 'visible'
                AND (CAST(:rating AS smallint) IS NULL OR r.rating = CAST(:rating AS smallint))
                AND (NOT :withImages OR cardinality(r.image_paths) > 0)
            """ + " ORDER BY " + order,
            new MapSqlParameterSource().addValue("garmentId", garmentId).addValue("viewerId", viewerId)
                .addValue("rating", rating).addValue("withImages", withImages));
        return withImagePaths(rows);
    }

    public List<Map<String, Object>> mine(Jwt jwt) {
        ProfileResponse profile = profiles.get(jwt);
        UUID id = UUID.fromString(profile.id());
        return withImagePaths(jdbc.queryForList("""
            SELECT DISTINCT r.id, r.booking_id AS "bookingId", r.garment_id AS "garmentId",
                   r.customer_id AS "customerId", r.customer_name_snapshot AS "customerName",
                   r.rating, r.fit, r.condition, r.comment, r.image_paths AS "imagePaths",
                   r.created_at AS "createdAt", true AS "verifiedRental"
            FROM reviews r JOIN garments g ON g.id = r.garment_id
            WHERE r.visibility = 'visible' AND (r.customer_id = :id OR g.owner_id = :id)
            ORDER BY r.created_at DESC
            """, Map.of("id", id)));
    }

    @Transactional
    public Map<String, Object> create(Jwt jwt, UUID bookingId, ReviewRequest request) {
        ProfileResponse customer = profiles.get(jwt);
        if (!"personal".equals(customer.role())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only a personal renter can review a completed rental.");
        }
        UUID customerId = UUID.fromString(customer.id());
        List<Map<String, Object>> bookings = jdbc.queryForList("""
            SELECT b.id, b.customer_id AS "customerId", b.garment_id AS "garmentId", b.status
            FROM bookings b WHERE b.id = :id
            """, Map.of("id", bookingId));
        if (bookings.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "This rental could not be found.");
        Map<String, Object> booking = bookings.getFirst();
        if (!customerId.toString().equals(booking.get("customerId").toString())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the renter can leave feedback for this booking.");
        }
        if (!"completed".equals(booking.get("status"))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Feedback is available after the rental is completed.");
        }
        String fit = clean(request.fit());
        String condition = clean(request.condition());
        String comment = clean(request.comment());
        if (comment != null && comment.length() > 600) comment = comment.substring(0, 600);
        List<String> imagePaths = cleanImagePaths(request.imagePaths(), customerId);
        jdbc.update("""
            INSERT INTO reviews (booking_id, garment_id, customer_id, customer_name_snapshot, rating, fit, condition, comment, image_paths)
            VALUES (:bookingId, :garmentId, :customerId, :customerName, :rating, :fit, :condition, :comment,
                string_to_array(:imagePaths, ','))
            """, new MapSqlParameterSource()
                .addValue("bookingId", bookingId)
                .addValue("garmentId", UUID.fromString(booking.get("garmentId").toString()))
                .addValue("customerId", customerId)
                .addValue("customerName", customer.name())
                .addValue("rating", request.rating())
                .addValue("fit", fit)
                .addValue("condition", condition)
                .addValue("comment", comment)
                .addValue("imagePaths", String.join(",", imagePaths)));
        return withImagePaths(List.of(jdbc.queryForMap("""
            SELECT id, booking_id AS "bookingId", garment_id AS "garmentId", customer_id AS "customerId",
                   customer_name_snapshot AS "customerName", rating, fit, condition, comment,
                   image_paths AS "imagePaths", created_at AS "createdAt", true AS "verifiedRental",
                   0 AS "helpfulCount", false AS "helpfulByMe"
            FROM reviews WHERE booking_id = :bookingId
            """, Map.of("bookingId", bookingId)))).getFirst();
    }

    @Transactional
    public Map<String, Object> toggleHelpful(Jwt jwt, UUID reviewId) {
        ProfileResponse voter = profiles.get(jwt);
        UUID voterId = UUID.fromString(voter.id());
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT customer_id AS \"customerId\" FROM reviews WHERE id = :id AND visibility = 'visible'", Map.of("id", reviewId));
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "This review could not be found.");
        if (voterId.toString().equals(rows.getFirst().get("customerId").toString())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You cannot vote on your own review.");
        }
        int removed = jdbc.update("DELETE FROM review_helpful_votes WHERE review_id = :reviewId AND profile_id = :profileId",
            Map.of("reviewId", reviewId, "profileId", voterId));
        boolean helpful = removed == 0;
        if (helpful) {
            jdbc.update("INSERT INTO review_helpful_votes (review_id, profile_id) VALUES (:reviewId, :profileId) ON CONFLICT DO NOTHING",
                Map.of("reviewId", reviewId, "profileId", voterId));
        }
        Number count = jdbc.queryForObject("SELECT count(*) FROM review_helpful_votes WHERE review_id = :reviewId", Map.of("reviewId", reviewId), Number.class);
        return Map.of("helpful", helpful, "helpfulCount", count == null ? 0 : count.intValue());
    }

    private static List<String> cleanImagePaths(List<String> values, UUID customerId) {
        if (values == null || values.isEmpty()) return List.of();
        if (values.size() > 3) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Add no more than three review photos.");
        List<String> paths = new ArrayList<>();
        for (String value : values) {
            String path = value == null ? "" : value.trim();
            if (!path.matches("[0-9a-fA-F-]{36}/reviews/[0-9a-fA-F-]{36}\\.(?:jpg|jpeg|png|webp)")) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A review photo path is not valid.");
            }
            if (!path.startsWith(customerId + "/reviews/")) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Review photos must belong to your account.");
            }
            paths.add(path);
        }
        return paths.stream().distinct().toList();
    }

    private static List<Map<String, Object>> withImagePaths(List<Map<String, Object>> rows) {
        return rows.stream().map(row -> {
            Map<String, Object> result = new LinkedHashMap<>(row);
            result.put("imagePaths", stringArray(row.get("imagePaths")));
            return result;
        }).toList();
    }

    private static List<String> stringArray(Object value) {
        if (value == null) return List.of();
        try {
            Object raw = value instanceof java.sql.Array array ? array.getArray() : value;
            if (raw instanceof String[] strings) return java.util.Arrays.stream(strings).filter(item -> item != null && !item.isBlank()).toList();
            if (raw instanceof Object[] array) return java.util.Arrays.stream(array).map(String::valueOf).toList();
            if (raw instanceof List<?> list) return list.stream().map(String::valueOf).toList();
        } catch (Exception ignored) { return List.of(); }
        return List.of();
    }

    private static String clean(String value) {
        if (value == null) return null;
        String cleaned = value.trim();
        return cleaned.isEmpty() ? null : cleaned;
    }
}
