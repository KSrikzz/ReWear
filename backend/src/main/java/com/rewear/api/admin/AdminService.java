package com.rewear.api.admin;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
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
import com.rewear.api.protection.ProtectionService;
import com.rewear.api.admin.AdminController.ClaimDecision;

@Service
public class AdminService {
    private final NamedParameterJdbcTemplate jdbc;
    private final ProfileService profiles;
    private final FinancialProperties finances;
    private final ProtectionService protection;
    public AdminService(NamedParameterJdbcTemplate jdbc, ProfileService profiles, FinancialProperties finances, ProtectionService protection) {
        this.jdbc=jdbc; this.profiles=profiles; this.finances=finances; this.protection=protection;
    }

    public Map<String, Object> overview(Jwt jwt) {
        requireAdmin(jwt);
        return jdbc.queryForMap("""
            SELECT (SELECT count(*) FROM garments) AS "totalGarments",
                   (SELECT count(*) FROM garments WHERE active AND NOT under_maintenance AND retired_at IS NULL) AS "activeGarments",
                   (SELECT count(*) FROM garments WHERE NOT active OR retired_at IS NOT NULL) AS "removedGarments",
                   (SELECT count(*) FROM garments WHERE retail_value >= :threshold) AS "highValueGarments",
                   (SELECT count(*) FROM garments WHERE retail_value >= :threshold AND :protectionRequired) AS "highValueProtectionRequired",
                   0::bigint AS "pendingGarments",
                   (SELECT count(DISTINCT garment_id) FROM bookings WHERE status IN ('confirmed','in_use','return_pending') AND daterange(pickup_date,return_date,'[]') @> current_date) AS "rentedToday",
                   (SELECT count(*) FROM profiles WHERE role = 'personal') AS "personalAccounts",
                   (SELECT count(*) FROM profiles WHERE role = 'business') AS "businessAccounts",
                   (SELECT count(*) FROM profiles) AS "registeredUsers",
                   (SELECT count(*) FROM profiles WHERE created_at::date = current_date) AS "newUsersToday",
                   (SELECT count(*) FROM bookings) AS "totalRentals",
                   (SELECT count(*) FROM bookings WHERE status IN ('confirmed','in_use','return_pending')) AS "activeRentals",
                   (SELECT count(*) FROM bookings WHERE status = 'completed') AS "completedRentals",
                   (SELECT count(*) FROM bookings WHERE status IN ('declined','cancelled')) AS "cancelledRentals",
                   (SELECT COALESCE(sum(commission_amount), 0) FROM commission_ledger) AS "platformCommissions",
                   (SELECT COALESCE(sum(amount), 0) FROM payment_transactions WHERE payment_type = 'MEMBERSHIP' AND status = 'successful') AS "membershipRevenue",
                   (SELECT COALESCE(sum(amount), 0) FROM payment_transactions WHERE status = 'successful') AS "transactionVolume",
                   (SELECT count(*) FROM businesses WHERE membership_status = 'active' AND current_period_end > now()) AS "activeMemberships",
                   (SELECT count(*) FROM businesses WHERE membership_status = 'expired' OR (membership_status = 'active' AND current_period_end <= now())) AS "expiredMemberships",
                   (SELECT count(*) FROM businesses WHERE plan_id = 'silver' AND membership_status = 'active' AND current_period_end > now()) AS "silverMembers",
                   (SELECT count(*) FROM businesses WHERE plan_id = 'gold' AND membership_status = 'active' AND current_period_end > now()) AS "goldMembers",
                   (SELECT COALESCE(sum(protection_premium), 0) FROM bookings WHERE payment_status = 'successful') AS "protectionRevenue",
                   (SELECT count(*) FROM protection_claims WHERE status IN ('pending','seller_responded')) AS "pendingClaims",
                   0::bigint AS "pendingDisputes"
            """, Map.of("threshold", finances.highValueThreshold(), "protectionRequired", finances.highValueProtectionRequired()));
    }

    public List<Map<String, Object>> users(Jwt jwt) {
        requireAdmin(jwt);
        return jdbc.queryForList("""
            SELECT p.id, p.role, p.name, p.email, p.phone, p.created_at AS "registeredAt",
                   b.business_name AS "businessName", b.plan_id AS "membershipPlan", b.membership_status AS "membershipStatus",
                   (SELECT count(*) FROM garments g WHERE g.owner_id = p.id) AS "listingCount",
                   (SELECT count(*) FROM bookings r WHERE r.customer_id = p.id OR r.owner_id = p.id) AS "rentalCount",
                   p.account_status AS "accountStatus",
                   (SELECT COALESCE(sum(pt.amount),0) FROM payment_transactions pt WHERE pt.user_id = p.id AND pt.status = 'successful') AS "paymentVolume"
            FROM profiles p LEFT JOIN businesses b ON b.profile_id = p.id
            ORDER BY p.created_at DESC LIMIT 500
            """, Map.of());
    }

    public Map<String,Object> setUserStatus(Jwt jwt, UUID id, String requestedStatus) {
        requireAdmin(jwt);
        String status = requestedStatus.trim().toLowerCase();
        if (!List.of("active", "suspended").contains(status)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose active or suspended.");
        int changed = jdbc.update("UPDATE profiles SET account_status=:status, updated_at=now() WHERE id=:id AND role <> 'admin'",
            Map.of("status",status,"id",id));
        if (changed == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"User not found or administrator accounts cannot be suspended here.");
        return jdbc.queryForMap("SELECT id, role, account_status AS \"accountStatus\" FROM profiles WHERE id=:id",Map.of("id",id));
    }
    public List<Map<String, Object>> memberships(Jwt jwt) {
        requireAdmin(jwt);
        return jdbc.queryForList("""
            SELECT p.id AS "businessUserId", b.business_name AS "businessName", p.name AS "ownerName", p.email, p.phone,
                   b.plan_id AS plan,
                   CASE WHEN b.membership_status = 'active' AND b.current_period_end <= now() THEN 'expired' ELSE b.membership_status END AS status,
                   (SELECT h.start_date FROM business_membership_history h WHERE h.profile_id=p.id ORDER BY h.created_at DESC LIMIT 1) AS "membershipStart",
                   b.current_period_end AS "membershipExpiry",
                   (SELECT count(*) FROM garments g WHERE g.owner_id=p.id) AS "totalListings",
                   (SELECT count(*) FROM bookings r WHERE r.owner_id=p.id) AS "totalRentals",
                   (SELECT COALESCE(sum(c.commission_amount),0) FROM commission_ledger c WHERE c.owner_id=p.id) AS "platformFees"
            FROM businesses b JOIN profiles p ON p.id=b.profile_id ORDER BY b.updated_at DESC
            """, Map.of());
    }
    public List<Map<String, Object>> garments(Jwt jwt) {
        requireAdmin(jwt);
        return jdbc.queryForList("""
            SELECT g.id, g.name, g.category, g.owner_type AS "ownerType", g.owner_name AS "ownerName", g.rental_price AS "dailyPrice",
                   g.retail_value AS "retailValue", g.stock_quantity AS quantity, g.active, g.under_maintenance AS "underMaintenance",
                   g.retired_at AS "retiredAt", g.created_at AS "createdAt"
            FROM garments g ORDER BY g.created_at DESC LIMIT 500
            """, Map.of());
    }
    public List<Map<String, Object>> rentals(Jwt jwt) {
        requireAdmin(jwt);
        return jdbc.queryForList("""
            SELECT id, garment_name_snapshot AS "garmentName", customer_name_snapshot AS "customerName", owner_name_snapshot AS "ownerName",
                   pickup_date AS "pickupDate", return_date AS "returnDate", status, payment_status AS "paymentStatus",
                   total_payable AS total, commission_amount AS commission, protection_enabled AS "protectionEnabled"
            FROM bookings ORDER BY requested_at DESC LIMIT 500
            """, Map.of());
    }
    public List<Map<String, Object>> payments(Jwt jwt) {
        requireAdmin(jwt);
        return jdbc.queryForList("""
            SELECT transaction_id AS "transactionId", user_id AS "userId", booking_id AS "bookingId", payment_type AS "paymentType",
                   amount, currency, status, payment_method AS "paymentMethod", gateway, created_at AS "createdAt"
            FROM payment_transactions ORDER BY created_at DESC LIMIT 500
            """, Map.of());
    }
    public List<Map<String, Object>> claims(Jwt jwt) {
        requireAdmin(jwt);
        List<Map<String,Object>> rows = jdbc.queryForList("""
            SELECT c.id, c.booking_id AS "bookingId", c.customer_id AS "customerId", c.owner_id AS "ownerId",
                   c.reason, c.requested_amount AS "requestedAmount", c.approved_amount AS "approvedAmount",
                   c.evidence_paths AS "evidencePaths", c.owner_response AS "ownerResponse", c.admin_note AS "adminNote", c.status,
                   c.submitted_at AS "submittedAt", b.garment_name_snapshot AS "garmentName"
            FROM protection_claims c JOIN bookings b ON b.id=c.booking_id ORDER BY c.submitted_at DESC LIMIT 500
            """, Map.of());
        return rows.stream().map(row -> {
            Map<String,Object> result = new java.util.LinkedHashMap<>(row);
            Object evidence = result.get("evidencePaths");
            if (evidence instanceof java.sql.Array array) {
                try { result.put("evidencePaths", java.util.Arrays.asList((String[]) array.getArray())); }
                catch (Exception ignored) { result.put("evidencePaths", List.of()); }
                finally { try { array.free(); } catch (Exception ignored) {} }
            }
            return result;
        }).toList();
    }

    @Transactional
    public Map<String, Object> resolveDispute(Jwt jwt, UUID bookingId, String resolution) {
        requireAdmin(jwt);
        Map<String, Object> booking;
        try { booking = jdbc.queryForMap("SELECT * FROM bookings WHERE id = :id", Map.of("id", bookingId)); }
        catch (Exception e) { throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Rental not found."); }
        if (!"disputed".equals(booking.get("status"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only disputed rentals can be resolved.");
        }
        java.math.BigDecimal gross = (java.math.BigDecimal) booking.get("rental_price");
        java.math.BigDecimal rate = (java.math.BigDecimal) booking.get("commission_rate");
        java.math.BigDecimal fee = gross.multiply(rate).setScale(0, java.math.RoundingMode.HALF_UP);
        java.math.BigDecimal net = gross.subtract(fee);
        jdbc.update("UPDATE bookings SET status = 'completed', updated_at = now(), completed_at = now(), commission_amount = :fee, owner_payout = :net WHERE id = :id", Map.of("fee", fee, "net", net, "id", bookingId));
        jdbc.update("INSERT INTO commission_ledger (booking_id, owner_id, gross_amount, commission_rate, commission_amount, owner_net_amount, status) VALUES (:bookingId, :ownerId, :gross, :rate, :fee, :net, 'estimated') ON CONFLICT (booking_id) DO NOTHING", Map.of("bookingId", bookingId, "ownerId", booking.get("owner_id"), "gross", gross, "rate", rate, "fee", fee, "net", net));
        return Map.of("success", true);
    }

    public Map<String, Object> decide(Jwt jwt, UUID claimId, ClaimDecision decision) {
        requireAdmin(jwt);
        String status = decision.decision().trim().toLowerCase();
        if (!List.of("approved", "rejected").contains(status)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose approve or reject.");
        Map<String,Object> claim;
        try { claim=jdbc.queryForMap("SELECT id, customer_id AS \"customerId\", requested_amount AS \"requestedAmount\", status FROM protection_claims WHERE id=:id FOR UPDATE", Map.of("id",claimId)); }
        catch (org.springframework.dao.EmptyResultDataAccessException missing) { throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Claim not found."); }
        if (List.of("approved","rejected").contains(claim.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT,"This claim has already been resolved.");
        BigDecimal approved = BigDecimal.ZERO;
        if ("approved".equals(status)) {
            approved = decision.approvedAmount() == null ? (BigDecimal)claim.get("requestedAmount") : decision.approvedAmount();
            if (approved.signum() <= 0 || approved.compareTo((BigDecimal)claim.get("requestedAmount")) > 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Approved amount must be positive and no greater than the claim amount.");
        }
        jdbc.update("UPDATE protection_claims SET status=:status, approved_amount=:amount, admin_note=:note, resolved_at=now() WHERE id=:id",
            new MapSqlParameterSource().addValue("status",status).addValue("amount",approved).addValue("note",decision.note()).addValue("id",claimId));
        if ("approved".equals(status)) {
            UUID refundId = UUID.randomUUID();
            String txn = "REWARPAY_" + DateTimeFormatter.ofPattern("yyyyMMdd").withZone(ZoneOffset.UTC).format(Instant.now()) + "_" + UUID.randomUUID().toString().replace("-", "").substring(0,7).toUpperCase();
            jdbc.update("""
                INSERT INTO payment_transactions(id, transaction_id, user_id, payment_type, amount, currency, status, payment_method, gateway)
                VALUES (:id,:txn,:userId,'REFUND',:amount,:currency,'refunded','wallet','REWEAR_PAY_GATEWAY')
                """, Map.of("id",refundId,"txn",txn,"userId",UUID.fromString(String.valueOf(claim.get("customerId"))),"amount",approved,"currency",finances.currency()));
        }
        return protection.claim(claimId);
    }

    private ProfileResponse requireAdmin(Jwt jwt) {
        ProfileResponse profile = profiles.get(jwt);
        if (!"admin".equals(profile.role())) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Administrator access is required.");
        return profile;
    }
}

