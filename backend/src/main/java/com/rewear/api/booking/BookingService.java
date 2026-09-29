package com.rewear.api.booking;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
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

import com.rewear.api.booking.BookingDtos.CreateRequest;
import com.rewear.api.booking.BookingDtos.ReviewRequest;
import com.rewear.api.commission.CommissionService;
import com.rewear.api.config.FinancialProperties;
import com.rewear.api.garment.GarmentService;
import com.rewear.api.profile.ProfileDtos.ProfileResponse;
import com.rewear.api.profile.ProfileService;

@Service
public class BookingService {
    private static final String BOOKING_SELECT = """
        SELECT b.id, b.customer_id AS "customerId", b.customer_name_snapshot AS "customerName",
               b.garment_id AS "garmentId", b.garment_name_snapshot AS "garmentName",
               b.garment_image_snapshot AS "garmentImage", b.owner_id AS "ownerId",
               b.owner_type_snapshot AS "ownerType", b.owner_name_snapshot AS "ownerName",
               b.rental_price_snapshot AS "rentalPrice", b.rental_days AS duration, b.selected_size AS "selectedSize",
               b.total_payable AS "estimatedTotal", b.platform_fee_amount AS "platformFee",
               b.protection_enabled AS "protectionEnabled", b.protection_premium AS "protectionPremium",
               b.deposit_amount_snapshot AS deposit, b.payment_status AS "paymentStatus", b.payment_required AS "paymentRequired",
               b.high_value_protection_required AS "highValueProtectionRequired",
               b.pickup_date AS "pickupDate",
               b.return_date AS "returnDate", b.fulfilment, b.rental_care AS "rentalCare",
               CASE WHEN b.status IN ('confirmed', 'in_use', 'return_pending', 'completed')
                    THEN b.customer_postcode ELSE NULL END AS "customerPostcode",
               b.status, b.commission_rate AS "commissionRate", b.commission_amount AS "commissionAmount",
               b.owner_payout AS "estimatedOwnerPayout", b.requested_at AS "requestedAt",
               b.confirmed_at AS "confirmedAt", b.declined_at AS "declinedAt", b.cancelled_at AS "cancelledAt",
               b.picked_up_at AS "pickedUpAt", b.returned_at AS "returnedAt", b.completed_at AS "completedAt",
               b.updated_at AS "updatedAt"
        FROM bookings b
        """;

    private final NamedParameterJdbcTemplate jdbc;
    private final ProfileService profiles;
    private final GarmentService garments;
    private final CommissionService commissions;
    private final FinancialProperties finances;

    public BookingService(NamedParameterJdbcTemplate jdbc, ProfileService profiles, GarmentService garments,
                          CommissionService commissions, FinancialProperties finances) {
        this.jdbc = jdbc;
        this.profiles = profiles;
        this.garments = garments;
        this.commissions = commissions;
        this.finances = finances;
    }

    @Transactional
    public Map<String, Object> create(Jwt jwt, UUID garmentId, CreateRequest request) {
        ProfileResponse customer = profiles.get(jwt);
        if (!List.of("personal", "business").contains(customer.role())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This account type cannot request rentals.");
        }
        if (request.pickupDate().isBefore(LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a pickup date that is today or later.");
        }
        if (request.returnDate().isBefore(request.pickupDate())
            || ChronoUnit.DAYS.between(request.pickupDate(), request.returnDate()) != request.duration()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The return date must match the selected rental length.");
        }
        String fulfilment = request.fulfilment().trim().toLowerCase();
        if (!List.of("pickup", "delivery").contains(fulfilment)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose pickup or local delivery.");
        }

        Integer stockQuantity;
        try {
            stockQuantity = jdbc.queryForObject(
                "SELECT stock_quantity FROM garments WHERE id = :id FOR UPDATE",
                Map.of("id", garmentId), Integer.class);
        } catch (org.springframework.dao.EmptyResultDataAccessException missing) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "This clothing listing is not available.");
        }
        Map<String, Object> garment = garments.get(garmentId);
        String selectedSize = request.selectedSize().trim();
        List<String> availableSizes = java.util.Arrays.stream(String.valueOf(garment.get("size")).split(","))
            .map(String::trim).filter(value -> !value.isBlank()).toList();
        if (!availableSizes.contains(selectedSize)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose one of the sizes available for this listing.");
        }
        if (Boolean.FALSE.equals(garment.get("available"))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This listing is paused and cannot be requested right now.");
        }
        if ("pickup".equals(fulfilment) && Boolean.FALSE.equals(garment.get("pickupAvailable"))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Pickup is not available for this listing.");
        }
        String deliveryPostcode = normalizePostcode(request.deliveryPostcode());
        if ("delivery".equals(fulfilment)) {
            if (!Boolean.TRUE.equals(garment.get("deliveryAvailable"))) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Delivery is not available for this listing.");
            }
            if (deliveryPostcode.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter your delivery PIN code.");
            }
            List<String> coverage = stringArray(garment.get("deliveryPostcodes"));
            if (!coverage.isEmpty() && coverage.stream().map(BookingService::normalizePostcode).noneMatch(code -> code.equals(deliveryPostcode))) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "This listing does not deliver to that PIN code.");
            }
        }
        UUID customerId = UUID.fromString(customer.id());
        Object ownerObject = garment.get("ownerId");
        UUID ownerId = ownerObject == null ? null : UUID.fromString(ownerObject.toString());
        if (ownerId == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "This  listing has no connected seller account and cannot accept rental requests.");
        }
        if (customerId.equals(ownerId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You cannot request your own listing.");
        }

        Integer peakReservedPieces = jdbc.queryForObject("""
            SELECT COALESCE(MAX((
                SELECT count(*) FROM bookings b
                WHERE b.garment_id = :garmentId
                  AND b.status IN ('requested', 'confirmed', 'in_use', 'return_pending')
                  AND daterange(b.pickup_date, b.return_date, '[]') @> dates.rental_day
            )), 0)
            FROM (
                SELECT CAST(:pickupDate AS date) AS rental_day
                UNION
                SELECT pickup_date FROM bookings
                WHERE garment_id = :garmentId
                  AND status IN ('requested', 'confirmed', 'in_use', 'return_pending')
                  AND pickup_date BETWEEN :pickupDate AND :returnDate
                  AND daterange(pickup_date, return_date, '[]') && daterange(:pickupDate, :returnDate, '[]')
            ) dates
            """, new MapSqlParameterSource().addValue("garmentId", garmentId)
                .addValue("pickupDate", request.pickupDate()).addValue("returnDate", request.returnDate()), Integer.class);
        if (peakReservedPieces != null && peakReservedPieces >= stockQuantity) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "All pieces in this listing are already reserved for those dates. Choose another rental period.");
        }

        BigDecimal feeRate = commissions.rateForOwner(ownerId, String.valueOf(garment.get("ownerType")));
        BigDecimal price = ((BigDecimal) garment.get("price")).multiply(BigDecimal.valueOf(request.duration()));
        BigDecimal fee = price.multiply(feeRate).setScale(2, RoundingMode.HALF_UP);
        BigDecimal retailValue = garment.get("mrp") instanceof BigDecimal value ? value : BigDecimal.ZERO;
        boolean highValue = retailValue.compareTo(finances.highValueThreshold()) >= 0;
        boolean protectionEnabled = request.rentalProtection() || (highValue && finances.highValueProtectionRequired());
        BigDecimal protectionPremium = protectionEnabled
            ? price.multiply(finances.protectionBaseRatePercent()).setScale(2, RoundingMode.HALF_UP)
                .max(finances.protectionMinPremium()).min(finances.protectionMaxPremium())
            : BigDecimal.ZERO;
        BigDecimal deposit = garment.get("depositAmount") instanceof BigDecimal value ? value : BigDecimal.ZERO;
        BigDecimal totalPayable = price.add(fee).add(protectionPremium).add(deposit);
        String id = UUID.randomUUID().toString();

        MapSqlParameterSource values = new MapSqlParameterSource()
            .addValue("id", UUID.fromString(id))
            .addValue("garmentId", garmentId)
            .addValue("customerId", customerId)
            .addValue("ownerId", ownerId)
            .addValue("customerName", customer.name())
            .addValue("garmentName", garment.get("name"))
            .addValue("garmentImage", garment.get("image"))
            .addValue("ownerName", garment.get("ownerName"))
            .addValue("ownerType", garment.get("ownerType"))
            .addValue("price", price)
            .addValue("fee", fee)
            .addValue("protectionEnabled", protectionEnabled)
            .addValue("protectionPremium", protectionPremium)
            .addValue("deposit", deposit)
            .addValue("totalPayable", totalPayable)
            .addValue("highValueProtectionRequired", highValue && finances.highValueProtectionRequired())
            .addValue("defaultDays", 1)
            .addValue("duration", request.duration())
            .addValue("selectedSize", selectedSize)
            .addValue("pickupDate", request.pickupDate())
            .addValue("returnDate", request.returnDate())
            .addValue("fulfilment", fulfilment)
            .addValue("customerPostcode", deliveryPostcode.isBlank() ? null : deliveryPostcode)
            .addValue("rentalCare", request.rentalCare())
            .addValue("commissionRate", feeRate);

        jdbc.update("""
            INSERT INTO bookings (id, garment_id, customer_id, owner_id, customer_name_snapshot,
                garment_name_snapshot, garment_image_snapshot, owner_name_snapshot, owner_type_snapshot,
                rental_price_snapshot, default_days_snapshot, rental_days, selected_size, pickup_date, return_date,
                fulfilment, rental_care, customer_postcode, status, commission_rate, platform_fee_amount,
                protection_enabled, protection_premium, deposit_amount_snapshot, total_payable, payment_required, high_value_protection_required)
            VALUES (:id, :garmentId, :customerId, :ownerId, :customerName,
                :garmentName, :garmentImage, :ownerName, :ownerType,
                :price, :defaultDays, :duration, :selectedSize, :pickupDate, :returnDate,
                :fulfilment, :rentalCare, :customerPostcode, 'requested', :commissionRate, :fee,
                :protectionEnabled, :protectionPremium, :deposit, :totalPayable, true, :highValueProtectionRequired)
            """, values);
        addEvent(UUID.fromString(id), customerId, customer.name(), customer.role(), "requested");
        return withEvents(one(UUID.fromString(id)));
    }

    public List<Map<String, Object>> mine(Jwt jwt) {
        UUID userId = UUID.fromString(profiles.get(jwt).id());
        List<Map<String, Object>> bookings = jdbc.queryForList(BOOKING_SELECT
            + " WHERE b.customer_id = :userId OR b.owner_id = :userId ORDER BY b.requested_at DESC", Map.of("userId", userId));
        return bookings.stream().map(this::withEvents).toList();
    }

    @Transactional
    public Map<String, Object> transition(Jwt jwt, UUID bookingId, String requestedStatus, List<String> photoPaths) {
        ProfileResponse actor = profiles.get(jwt);
        UUID actorId = UUID.fromString(actor.id());
        String next = requestedStatus.trim().toLowerCase().replace('-', '_').replace(' ', '_');
        Map<String, Object> booking = one(bookingId);
        String current = String.valueOf(booking.get("status"));
        UUID ownerId = booking.get("ownerId") == null ? null : UUID.fromString(booking.get("ownerId").toString());
        UUID customerId = UUID.fromString(booking.get("customerId").toString());
        boolean owner = actorId.equals(ownerId);
        boolean customer = actorId.equals(customerId);
        boolean allowed = switch (current) {
            case "requested" -> (owner && List.of("confirmed", "declined").contains(next)) || (customer && "cancelled".equals(next));
            case "confirmed" -> (owner && List.of("in_use", "cancelled").contains(next)) || (customer && "cancelled".equals(next));
            case "in_use" -> customer && "return_pending".equals(next);
            case "return_pending" -> owner && "completed".equals(next);
            default -> false;
        };
        if ("confirmed".equals(next) && Boolean.TRUE.equals(booking.get("paymentRequired"))
            && !"successful".equals(booking.get("paymentStatus"))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This rental cannot be confirmed until payment succeeds.");
        }
        boolean highValuePhotosRequired = Boolean.TRUE.equals(booking.get("highValueProtectionRequired"));
        List<String> evidencePaths = photoPaths == null ? List.of() : photoPaths.stream().filter(path -> path != null && path.startsWith(actorId + "/")).limit(5).toList();
        if (photoPaths != null && evidencePaths.size() != photoPaths.size()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rental evidence photos must be uploaded to your own account folder.");
        if (highValuePhotosRequired && "in_use".equals(next) && evidencePaths.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Add at least one handover photo for this high-value rental.");
        if (highValuePhotosRequired && "return_pending".equals(next) && evidencePaths.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Add at least one return photo for this high-value rental.");
        if (!allowed) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This account cannot make that rental status change.");
        if ("in_use".equals(next) && LocalDate.parse(booking.get("pickupDate").toString()).isAfter(LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "The rental can be marked in use on or after its pickup date.");
        }

        String timestampColumn = switch (next) {
            case "confirmed" -> "confirmed_at";
            case "declined" -> "declined_at";
            case "cancelled" -> "cancelled_at";
            case "in_use" -> "picked_up_at";
            case "return_pending" -> "returned_at";
            case "completed" -> "completed_at";
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "That rental status is not supported.");
        };

        if ("completed".equals(next) && List.of("personal", "business").contains(booking.get("ownerType"))) {
            BigDecimal gross = (BigDecimal) booking.get("rentalPrice");
            BigDecimal rate = (BigDecimal) booking.get("commissionRate");
            BigDecimal fee = gross.multiply(rate).setScale(0, RoundingMode.HALF_UP);
            BigDecimal net = gross.subtract(fee);
            jdbc.update("""
                UPDATE bookings SET status = :status, updated_at = now(), completed_at = now(),
                    commission_amount = :fee, owner_payout = :net WHERE id = :id
                """, Map.of("status", next, "fee", fee, "net", net, "id", bookingId));
            jdbc.update("""
                INSERT INTO commission_ledger (booking_id, owner_id, gross_amount, commission_rate, commission_amount,
                    owner_net_amount, status)
                VALUES (:bookingId, :ownerId, :gross, :rate, :fee, :net, 'estimated')
                ON CONFLICT (booking_id) DO NOTHING
                """, Map.of("bookingId", bookingId, "ownerId", ownerId, "gross", gross, "rate", rate, "fee", fee, "net", net));
        } else {
            String photoColumn = "in_use".equals(next) ? ", handover_photo_paths = :photos" : "return_pending".equals(next) ? ", return_photo_paths = :photos" : "";
            MapSqlParameterSource transitionParams = new MapSqlParameterSource().addValue("status", next).addValue("id", bookingId);
            if ("in_use".equals(next) || "return_pending".equals(next)) transitionParams.addValue("photos", evidencePaths.toArray(String[]::new));
            jdbc.update("UPDATE bookings SET status = :status, updated_at = now(), " + timestampColumn + " = now() " + photoColumn + " WHERE id = :id", transitionParams);
        }
        addEvent(bookingId, actorId, actor.name(), actor.role(), next);
        return withEvents(one(bookingId));
    }

    private void addEvent(UUID bookingId, UUID actorId, String name, String role, String status) {
        jdbc.update("""
            INSERT INTO booking_events (booking_id, actor_id, actor_name_snapshot, actor_role_snapshot, status)
            VALUES (:bookingId, :actorId, :actorName, :actorRole, :status)
            """, Map.of("bookingId", bookingId, "actorId", actorId, "actorName", name, "actorRole", role, "status", status));
    }

    private Map<String, Object> one(UUID id) {
        List<Map<String, Object>> rows = jdbc.queryForList(BOOKING_SELECT + " WHERE b.id = :id", Map.of("id", id));
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "This rental request could not be found.");
        return rows.getFirst();
    }

    private Map<String, Object> withEvents(Map<String, Object> booking) {
        List<Map<String, Object>> events = jdbc.queryForList("""
            SELECT status, actor_id AS "actorId", actor_name_snapshot AS "actorName",
                   actor_role_snapshot AS "actorRole", created_at AS "createdAt"
            FROM booking_events WHERE booking_id = :id ORDER BY created_at
            """, Map.of("id", booking.get("id")));
        Map<String, Object> result = new HashMap<>(booking);
        result.put("events", events);
        result.put("estimatedOwnerPayout", booking.get("estimatedOwnerPayout"));
        return result;
    }

    private static List<String> stringArray(Object value) {
        if (value == null) return List.of();
        try {
            Object raw = value instanceof java.sql.Array array ? array.getArray() : value;
            if (raw instanceof String[] values) return java.util.Arrays.stream(values).filter(item -> item != null && !item.isBlank()).toList();
            if (raw instanceof Object[] values) return java.util.Arrays.stream(values).map(String::valueOf).toList();
            if (raw instanceof List<?> values) return values.stream().map(String::valueOf).toList();
        } catch (Exception ignored) { return List.of(); }
        return List.of(String.valueOf(value));
    }

    private static String normalizePostcode(String value) {
        return value == null ? "" : value.replaceAll("[^A-Za-z0-9]", "").toUpperCase(java.util.Locale.ROOT);
    }
}
