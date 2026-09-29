package com.rewear.api.payment;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
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
import com.rewear.api.payment.PaymentDtos.MembershipPaymentRequest;
import com.rewear.api.payment.PaymentDtos.SimulationRequest;
import com.rewear.api.profile.ProfileDtos.ProfileResponse;
import com.rewear.api.profile.ProfileService;

@Service
public class PaymentService {
    private static final DateTimeFormatter TXN_DATE = DateTimeFormatter.ofPattern("yyyyMMdd").withZone(ZoneOffset.UTC);
    private final NamedParameterJdbcTemplate jdbc;
    private final ProfileService profiles;
    private final FinancialProperties finances;

    public PaymentService(NamedParameterJdbcTemplate jdbc, ProfileService profiles, FinancialProperties finances) {
        this.jdbc = jdbc; this.profiles = profiles; this.finances = finances;
    }

    @Transactional
    public Map<String, Object> rental(Jwt jwt, UUID bookingId, SimulationRequest request) {
        ProfileResponse profile = profiles.get(jwt);
        String method = paymentMethod(request.paymentMethod());
        Map<String, Object> booking;
        try {
            booking = jdbc.queryForMap("""
                SELECT id, customer_id AS "customerId", total_payable AS amount, payment_status AS status, status AS "bookingStatus"
                FROM bookings WHERE id = :id FOR UPDATE
                """, Map.of("id", bookingId));
        } catch (org.springframework.dao.EmptyResultDataAccessException missing) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "This rental could not be found.");
        }
        if (!profile.id().equals(String.valueOf(booking.get("customerId")))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the renter can pay for this booking.");
        }
        if (!"approved".equals(booking.get("bookingStatus"))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Payment is only available for an approved rental request.");
        }
        if ("successful".equals(booking.get("status"))) {
            return jdbc.queryForMap("SELECT transaction_id AS \"transactionId\", payment_type AS \"paymentType\", amount, currency, status, payment_method AS \"paymentMethod\", gateway, created_at AS \"createdAt\" FROM payment_transactions WHERE booking_id = :id AND status = 'successful' ORDER BY created_at DESC LIMIT 1", Map.of("id", bookingId));
        }
        BigDecimal amount = (BigDecimal) booking.get("amount");
        boolean success = !Boolean.FALSE.equals(request.succeed());
        UUID paymentId = insert(profile.id(), bookingId, "RENTAL", amount, method, null, "processing");
        String finalStatus = success ? "successful" : "failed";
        jdbc.update("UPDATE payment_transactions SET status = :status, updated_at = now() WHERE id = :id",
            Map.of("status", finalStatus, "id", paymentId));
        jdbc.update("UPDATE bookings SET payment_status = :status, status = CASE WHEN :status = 'failed' THEN 'cancelled' WHEN :status = 'successful' THEN 'confirmed' ELSE status END, updated_at = now() WHERE id = :id",
            Map.of("status", finalStatus, "id", bookingId));
        return payment(paymentId);
    }

    @Transactional
    public Map<String, Object> membership(Jwt jwt, MembershipPaymentRequest request) {
        ProfileResponse profile = profiles.get(jwt);
        if (!"business".equals(profile.role())) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only business accounts can purchase memberships.");
        String plan = request.planId().trim().toLowerCase();
        BigDecimal amount = switch (plan) {
            case "silver" -> finances.silverMonthlyPrice();
            case "gold" -> finances.goldMonthlyPrice();
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose Silver or Gold membership.");
        };
        String method = paymentMethod(request.paymentMethod());
        boolean success = !Boolean.FALSE.equals(request.succeed());
        UUID paymentId = insert(profile.id(), null, "MEMBERSHIP", amount, method, plan, "processing");
        String finalStatus = success ? "successful" : "failed";
        jdbc.update("UPDATE payment_transactions SET status = :status, updated_at = now() WHERE id = :id",
            Map.of("status", finalStatus, "id", paymentId));
        if (success) {
            Instant starts = Instant.now();
            Instant ends = starts.plus(java.time.Duration.ofDays(30));
            jdbc.update("""
                UPDATE businesses SET plan_id = :plan, membership_status = 'active', current_period_end = :ends, updated_at = now()
                WHERE profile_id = :profileId
                """, Map.of("plan", plan, "ends", OffsetDateTime.ofInstant(ends, ZoneOffset.UTC), "profileId", UUID.fromString(profile.id())));
            jdbc.update("""
                INSERT INTO business_membership_history (profile_id, plan_id, amount, currency, status, start_date, end_date, payment_id)
                VALUES (:profileId, :plan, :amount, :currency, 'active', :starts, :ends, :paymentId)
                """, Map.of("profileId", UUID.fromString(profile.id()), "plan", plan, "amount", amount,
                    "currency", finances.currency(), "starts", OffsetDateTime.ofInstant(starts, ZoneOffset.UTC),
                    "ends", OffsetDateTime.ofInstant(ends, ZoneOffset.UTC), "paymentId", paymentId));
        }
        Map<String, Object> result = new java.util.LinkedHashMap<>(payment(paymentId));
        result.put("planId", plan);
        result.put("membershipStatus", success ? "active" : "failed");
        return result;
    }

    @Transactional
    public Map<String, Object> cancelRental(Jwt jwt, UUID bookingId) {
        ProfileResponse profile = profiles.get(jwt);
        Map<String,Object> booking;
        try { booking = jdbc.queryForMap("SELECT customer_id AS \"customerId\", total_payable AS amount, status AS \"bookingStatus\", payment_status AS \"paymentStatus\" FROM bookings WHERE id=:id FOR UPDATE", Map.of("id",bookingId)); }
        catch (org.springframework.dao.EmptyResultDataAccessException missing) { throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Rental request not found."); }
        if (!profile.id().equals(String.valueOf(booking.get("customerId")))) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Only the renter can cancel checkout.");
        if (!"approved".equals(booking.get("bookingStatus")) || "successful".equals(booking.get("paymentStatus"))) throw new ResponseStatusException(HttpStatus.CONFLICT,"This checkout can no longer be cancelled.");
        UUID paymentId = insert(profile.id(), bookingId, "RENTAL", (BigDecimal)booking.get("amount"), "wallet", null, "cancelled");
        jdbc.update("UPDATE bookings SET status='cancelled', payment_status='cancelled', cancelled_at=now(), updated_at=now() WHERE id=:id",Map.of("id",bookingId));
        return payment(paymentId);
    }

    public List<Map<String, Object>> mine(Jwt jwt) {
        String profileId = profiles.get(jwt).id();
        return jdbc.queryForList("""
            SELECT transaction_id AS "transactionId", payment_type AS "paymentType", booking_id AS "bookingId",
                   amount, currency, status, payment_method AS "paymentMethod", gateway,
                   membership_plan AS "membershipPlan", created_at AS "createdAt"
            FROM payment_transactions WHERE user_id = :id ORDER BY created_at DESC LIMIT 100
            """, Map.of("id", UUID.fromString(profileId)));
    }

    private UUID insert(String profileId, UUID bookingId, String type, BigDecimal amount, String method, String plan, String status) {
        UUID id = UUID.randomUUID();
        String txn = "REWARPAY_" + TXN_DATE.format(Instant.now()) + "_" + UUID.randomUUID().toString().replace("-", "").substring(0, 7).toUpperCase();
        jdbc.update("""
            INSERT INTO payment_transactions (id, transaction_id, user_id, booking_id, payment_type, amount, currency, status, payment_method, gateway, membership_plan)
            VALUES (:id, :txn, :userId, :bookingId, :type, :amount, :currency, :status, :method, 'REWEAR_PAY_GATEWAY', :plan)
            """, new MapSqlParameterSource().addValue("id", id).addValue("txn", txn)
                .addValue("userId", UUID.fromString(profileId)).addValue("bookingId", bookingId).addValue("type", type)
                .addValue("amount", amount).addValue("currency", finances.currency()).addValue("status", status)
                .addValue("method", method).addValue("plan", plan));
        return id;
    }

    private Map<String, Object> payment(UUID id) {
        return jdbc.queryForMap("""
            SELECT transaction_id AS "transactionId", payment_type AS "paymentType", booking_id AS "bookingId",
                   amount, currency, status, payment_method AS "paymentMethod", gateway,
                   membership_plan AS "membershipPlan", created_at AS "createdAt"
            FROM payment_transactions WHERE id = :id
            """, Map.of("id", id));
    }

    private String paymentMethod(String method) {
        String value = method == null ? "" : method.trim().toLowerCase().replace('-', '_').replace(' ', '_');
        if (!List.of("upi", "card", "net_banking", "wallet").contains(value)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose UPI, card, net banking, or wallet.");
        }
        return value;
    }
}
