package com.rewear.api.common;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<Map<String, Object>> handleStatus(ResponseStatusException exception) {
        return response(exception.getStatusCode().value(), exception.getReason());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException exception) {
        String detail = exception.getBindingResult().getFieldErrors().stream()
            .findFirst()
            .map(error -> error.getField() + ": " + error.getDefaultMessage())
            .orElse("Check the submitted values.");
        return response(HttpStatus.BAD_REQUEST.value(), detail);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<Map<String, Object>> handleConflict(DataIntegrityViolationException exception) {
        String cause = exception.getMostSpecificCause().getMessage();
        if (cause != null && cause.contains("bookings_no_open_overlap")) {
            return response(HttpStatus.CONFLICT.value(), "Those dates are no longer available. Choose another rental window.");
        }
        return response(HttpStatus.CONFLICT.value(), "That change conflicts with existing marketplace data.");
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<Map<String, Object>> handleForbidden(AccessDeniedException exception) {
        return response(HttpStatus.FORBIDDEN.value(), "You do not have permission to perform this action.");
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<Map<String, Object>> handleBadRequest(IllegalArgumentException exception) {
        return response(HttpStatus.BAD_REQUEST.value(), exception.getMessage());
    }

    private ResponseEntity<Map<String, Object>> response(int status, String detail) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", status);
        body.put("detail", detail == null ? "The request could not be completed." : detail);
        body.put("timestamp", Instant.now());
        return ResponseEntity.status(status).body(body);
    }
}
