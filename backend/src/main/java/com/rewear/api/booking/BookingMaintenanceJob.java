package com.rewear.api.booking;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.math.BigDecimal;
import java.math.RoundingMode;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class BookingMaintenanceJob {
    private static final Logger log = LoggerFactory.getLogger(BookingMaintenanceJob.class);
    private final NamedParameterJdbcTemplate jdbc;

    public BookingMaintenanceJob(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Scheduled(cron = "0 0 * * * *")
    @Transactional
    public void performMaintenance() {
        log.info("Running scheduled maintenance to patch booking loopholes...");
        
        // Loophole 1: Inventory Hoarding (Cancel abandoned requests)
        int abandonedRequests = jdbc.getJdbcTemplate().update(
            "UPDATE bookings SET status = 'cancelled', cancelled_at = now(), updated_at = now() " +
            "WHERE status = 'requested' AND requested_at < now() - INTERVAL '48 hours'");
        
        int abandonedApprovals = jdbc.getJdbcTemplate().update(
            "UPDATE bookings SET status = 'cancelled', cancelled_at = now(), updated_at = now() " +
            "WHERE status = 'approved' AND confirmed_at < now() - INTERVAL '24 hours'");
            
        // Loophole 2: Deposit Hostage (Auto-complete unconfirmed returns)
        List<Map<String, Object>> pendingReturns = jdbc.getJdbcTemplate().queryForList(
            "SELECT id, owner_id, rental_price_snapshot, commission_rate, owner_type_snapshot FROM bookings " +
            "WHERE status = 'return_pending' AND returned_at < now() - INTERVAL '48 hours'");
            
        for (Map<String, Object> booking : pendingReturns) {
            UUID bookingId = (UUID) booking.get("id");
            if (List.of("personal", "business").contains(booking.get("owner_type_snapshot"))) {
                BigDecimal gross = (BigDecimal) booking.get("rental_price_snapshot");
                BigDecimal rate = (BigDecimal) booking.get("commission_rate");
                BigDecimal fee = gross.multiply(rate).setScale(0, RoundingMode.HALF_UP);
                BigDecimal net = gross.subtract(fee);
                
                jdbc.update("UPDATE bookings SET status = 'completed', updated_at = now(), completed_at = now(), " +
                    "commission_amount = :fee, owner_payout = :net WHERE id = :id", 
                    Map.of("fee", fee, "net", net, "id", bookingId));
                
                jdbc.update("INSERT INTO commission_ledger (booking_id, owner_id, gross_amount, commission_rate, commission_amount, owner_net_amount, status) " +
                    "VALUES (:id, :ownerId, :gross, :rate, :fee, :net, 'pending')",
                    Map.of("id", bookingId, "ownerId", booking.get("owner_id"), "gross", gross, "rate", rate, "fee", fee, "net", net));
            } else {
                jdbc.update("UPDATE bookings SET status = 'completed', updated_at = now(), completed_at = now() WHERE id = :id", Map.of("id", bookingId));
            }
        }
            
        // Loophole 3: Payout Hostage (Force return on overdue items)
        int overdueRentals = jdbc.getJdbcTemplate().update(
            "UPDATE bookings SET status = 'return_pending', returned_at = now(), updated_at = now() " +
            "WHERE status = 'in_use' AND return_date < (CURRENT_DATE - 1)");

        log.info("Maintenance complete. Cancelled {} idle requests, {} idle approvals. Forced {} overdue returns, auto-completed {} pending returns.", 
            abandonedRequests, abandonedApprovals, overdueRentals, pendingReturns.size());
    }
}

