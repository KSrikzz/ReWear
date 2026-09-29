package com.rewear.api.protection;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
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
import com.rewear.api.config.FinancialProperties;
import com.rewear.api.profile.ProfileDtos.ProfileResponse;
import com.rewear.api.profile.ProfileService;
import com.rewear.api.protection.ProtectionDtos.ClaimRequest;
import com.rewear.api.protection.ProtectionDtos.OwnerResponse;

@Service
public class ProtectionService {
    private final NamedParameterJdbcTemplate jdbc;
    private final ProfileService profiles;
    private final FinancialProperties finances;
    public ProtectionService(NamedParameterJdbcTemplate jdbc, ProfileService profiles, FinancialProperties finances) {
        this.jdbc = jdbc; this.profiles = profiles; this.finances = finances;
    }

    public Map<String, Object> terms() {
        return Map.ofEntries(
            Map.entry("name", "ReWear Rental Protection"), Map.entry("regulatedInsurance", false),
            Map.entry("highValueThreshold", finances.highValueThreshold()), Map.entry("highValueProtectionRequired", finances.highValueProtectionRequired()),
            Map.entry("baseRatePercent", finances.protectionBaseRatePercent().multiply(BigDecimal.valueOf(100))),
            Map.entry("minimumPremium", finances.protectionMinPremium()), Map.entry("maximumPremium", finances.protectionMaxPremium()),
            Map.entry("standardCoverageLimit", finances.standardCoverageLimit()), Map.entry("highValueCoverageLimit", finances.highValueCoverageLimit()),
            Map.entry("standardClaimWindowHours", finances.standardClaimWindowHours()), Map.entry("highValueClaimWindowHours", finances.highValueClaimWindowHours()),
            Map.entry("covered", List.of("Eligible accidental spills or stains requiring professional cleaning", "Minor accidental tears and stitching issues", "Small accidental burns or scuffs within the plan limit")),
            Map.entry("excluded", List.of("Intentional damage or misuse", "Theft, loss, or pre-existing damage", "Unauthorised alterations", "Normal cosmetic wear", "Claims submitted after the claim window")));
    }

    @Transactional
    public Map<String, Object> submit(Jwt jwt, UUID bookingId, ClaimRequest request) {
        ProfileResponse profile = profiles.get(jwt);
        UUID customerId = UUID.fromString(profile.id());
        Map<String, Object> booking;
        try { booking = jdbc.queryForMap("""
            SELECT b.id, b.customer_id AS "customerId", b.owner_id AS "ownerId", b.protection_enabled AS protected,
                   b.protection_premium AS premium, b.status, b.returned_at AS "returnedAt", g.retail_value AS "retailValue"
            FROM bookings b JOIN garments g ON g.id = b.garment_id WHERE b.id = :id
            """, Map.of("id", bookingId)); }
        catch (org.springframework.dao.EmptyResultDataAccessException missing) { throw new ResponseStatusException(HttpStatus.NOT_FOUND, "The rental was not found."); }
        if (!customerId.toString().equals(String.valueOf(booking.get("customerId")))) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the renter can submit this claim.");
        if (!Boolean.TRUE.equals(booking.get("protected")) || BigDecimal.ZERO.compareTo((BigDecimal) booking.get("premium")) == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "This rental did not include Rental Protection.");
        if (!List.of("return_pending", "completed").contains(booking.get("status")) || booking.get("returnedAt") == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "Submit a claim after returning the garment.");
        boolean highValue = booking.get("retailValue") instanceof BigDecimal value && value.compareTo(finances.highValueThreshold()) >= 0;
        int window = highValue ? finances.highValueClaimWindowHours() : finances.standardClaimWindowHours();
        OffsetDateTime returnedAt = (OffsetDateTime) booking.get("returnedAt");
        if (returnedAt.plusHours(window).isBefore(OffsetDateTime.now())) throw new ResponseStatusException(HttpStatus.GONE, "The claim window for this rental has ended.");
        BigDecimal limit = highValue ? finances.highValueCoverageLimit() : finances.standardCoverageLimit();
        if (request.requestedAmount() == null || request.requestedAmount().compareTo(limit) > 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The requested amount exceeds this plan's coverage limit.");
        List<String> paths = request.evidencePaths() == null ? List.of() : request.evidencePaths().stream().filter(path -> path != null && path.startsWith(profile.id() + "/")).limit(3).toList();
        if (request.evidencePaths() != null && paths.size() != request.evidencePaths().size()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Claim evidence must be uploaded to your own ReWear folder.");
        UUID claimId = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO protection_claims (id, booking_id, customer_id, owner_id, reason, requested_amount, evidence_paths)
            VALUES (:id, :bookingId, :customerId, :ownerId, :reason, :amount, :evidence)
            """, new MapSqlParameterSource().addValue("id", claimId).addValue("bookingId", bookingId)
                .addValue("customerId", customerId).addValue("ownerId", UUID.fromString(String.valueOf(booking.get("ownerId"))))
                .addValue("reason", request.reason().trim()).addValue("amount", request.requestedAmount()).addValue("evidence", paths.toArray(String[]::new)));
        return claim(claimId);
    }

    @Transactional
    public Map<String, Object> respond(Jwt jwt, UUID claimId, OwnerResponse request) {
        UUID ownerId = UUID.fromString(profiles.get(jwt).id());
        int changed = jdbc.update("UPDATE protection_claims SET owner_response = :response, status = 'seller_responded' WHERE id = :id AND owner_id = :ownerId AND status = 'pending'",
            Map.of("response", request.response().trim(), "id", claimId, "ownerId", ownerId));
        if (changed == 0) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This claim is not awaiting a response from your wardrobe.");
        return claim(claimId);
    }

    public List<Map<String, Object>> mine(Jwt jwt) {
        UUID id = UUID.fromString(profiles.get(jwt).id());
        List<Map<String,Object>> rows = jdbc.queryForList("""
            SELECT c.id, c.booking_id AS "bookingId", c.reason, c.requested_amount AS "requestedAmount",
                   c.approved_amount AS "approvedAmount", c.evidence_paths AS "evidencePaths", c.owner_response AS "ownerResponse",
                   c.admin_note AS "adminNote", c.status, c.submitted_at AS "submittedAt", c.resolved_at AS "resolvedAt",
                   b.garment_name_snapshot AS "garmentName", b.customer_id AS "customerId", b.owner_id AS "ownerId"
            FROM protection_claims c JOIN bookings b ON b.id = c.booking_id
            WHERE c.customer_id = :id OR c.owner_id = :id ORDER BY c.submitted_at DESC
            """, Map.of("id", id));
        return rows.stream().map(row -> {
            Map<String,Object> result = new java.util.LinkedHashMap<>(row);
            Object paths = result.get("evidencePaths");
            if (paths instanceof java.sql.Array array) {
                try { result.put("evidencePaths", java.util.Arrays.asList((String[]) array.getArray())); }
                catch (Exception ignored) { result.put("evidencePaths", List.of()); }
                finally { try { array.free(); } catch (Exception ignored) {} }
            }
            return result;
        }).toList();
    }

    public Map<String, Object> claim(UUID id) {
        return jdbc.queryForMap("""
            SELECT id, booking_id AS "bookingId", reason, requested_amount AS "requestedAmount", approved_amount AS "approvedAmount",
                   owner_response AS "ownerResponse", admin_note AS "adminNote", status, submitted_at AS "submittedAt", resolved_at AS "resolvedAt"
            FROM protection_claims WHERE id = :id
            """, Map.of("id", id));
    }
}
