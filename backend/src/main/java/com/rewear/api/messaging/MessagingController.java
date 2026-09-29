package com.rewear.api.messaging;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import com.rewear.api.profile.ProfileDtos.ProfileResponse;
import com.rewear.api.profile.ProfileService;

@RestController
@RequestMapping("/api/bookings/{bookingId}/messages")
public class MessagingController {

    private final NamedParameterJdbcTemplate jdbc;
    private final ProfileService profiles;

    public MessagingController(NamedParameterJdbcTemplate jdbc, ProfileService profiles) {
        this.jdbc = jdbc;
        this.profiles = profiles;
    }

    @GetMapping
    public List<Map<String, Object>> getMessages(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID bookingId) {
        ProfileResponse profile = profiles.get(jwt);
        UUID profileId = UUID.fromString(profile.id());
        // Verify user is participant in booking
        verifyParticipant(bookingId, profileId);
        return jdbc.queryForList("""
            SELECT id, booking_id AS "bookingId", sender_id AS "senderId", sender_name AS "senderName",
                   message, created_at AS "createdAt"
            FROM rental_messages WHERE booking_id = :bookingId ORDER BY created_at ASC
            """, Map.of("bookingId", bookingId));
    }

    @PostMapping
    public Map<String, Object> sendMessage(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID bookingId,
                                            @RequestBody Map<String, String> payload) {
        ProfileResponse profile = profiles.get(jwt);
        UUID profileId = UUID.fromString(profile.id());
        verifyParticipant(bookingId, profileId);

        String message = payload.getOrDefault("message", "").trim();
        if (message.isEmpty() || message.length() > 1000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Message must be between 1 and 1000 characters.");
        }

        UUID msgId = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO rental_messages (id, booking_id, sender_id, sender_name, message)
            VALUES (:id, :bookingId, :senderId, :senderName, :message)
            """, Map.of("id", msgId, "bookingId", bookingId, "senderId", profileId,
                        "senderName", profile.name(), "message", message));

        return jdbc.queryForMap("""
            SELECT id, booking_id AS "bookingId", sender_id AS "senderId", sender_name AS "senderName",
                   message, created_at AS "createdAt"
            FROM rental_messages WHERE id = :id
            """, Map.of("id", msgId));
    }

    private void verifyParticipant(UUID bookingId, UUID profileId) {
        Integer count = jdbc.queryForObject(
            "SELECT count(*) FROM bookings WHERE id = :bookingId AND (customer_id = :profileId OR owner_id = :profileId)",
            Map.of("bookingId", bookingId, "profileId", profileId), Integer.class);
        if (count == null || count == 0) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not a participant in this rental.");
        }
    }
}
