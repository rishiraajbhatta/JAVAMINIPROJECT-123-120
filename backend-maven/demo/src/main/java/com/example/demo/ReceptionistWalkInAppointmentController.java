package com.example.demo;

import com.example.demo.dto.PaymentVerificationRequest;
import com.example.demo.entity.Appointment;
import com.example.demo.entity.Doctor;
import com.example.demo.entity.Patient;

import com.example.demo.repository.AppointmentRepository;
import com.example.demo.repository.DoctorRepository;
import com.example.demo.repository.PatientRepository;

import com.example.demo.service.AppointmentService;
import com.example.demo.service.EmailService;
import com.example.demo.service.PaymentService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/receptionist/walk-in-appointments")
public class ReceptionistWalkInAppointmentController {

    private final PatientRepository patientRepository;
    private final DoctorRepository doctorRepository;
    private final AppointmentRepository appointmentRepository;
    private final AppointmentService appointmentService;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;
    private final PaymentService paymentService;

    public ReceptionistWalkInAppointmentController(
            PatientRepository patientRepository,
            DoctorRepository doctorRepository,
            AppointmentRepository appointmentRepository,
            AppointmentService appointmentService,
            EmailService emailService,
            PasswordEncoder passwordEncoder,
            PaymentService paymentService
    ) {
        this.patientRepository = patientRepository;
        this.doctorRepository = doctorRepository;
        this.appointmentRepository = appointmentRepository;
        this.appointmentService = appointmentService;
        this.emailService = emailService;
        this.passwordEncoder = passwordEncoder;
        this.paymentService = paymentService;
    }

    // ==========================================
    // RECEPTIONIST AUTHENTICATION
    // ==========================================

    private boolean isReceptionistAuthenticated() {

        Authentication authentication =
                SecurityContextHolder.getContext().getAuthentication();

        return authentication != null
                && authentication.isAuthenticated()
                && authentication.getAuthorities().contains(
                        new SimpleGrantedAuthority("ROLE_RECEPTIONIST")
                );
    }

    // ==========================================
    // WALK-IN APPOINTMENT BOOKING
    // CASH = OFFLINE PAYMENT
    // CARD / UPI = RAZORPAY
    // ==========================================

    @PostMapping("/book")
    @Transactional
    public ResponseEntity<?> bookWalkInAppointment(
            @RequestBody Map<String, Object> request
    ) {

        if (!isReceptionistAuthenticated()) {
            return errorResponse(
                    HttpStatus.UNAUTHORIZED,
                    "Receptionist authentication required."
            );
        }

        String fullName = getString(request, "fullName");
        String email = getString(request, "email");
        String gender = getString(request, "gender");

        Integer age;
        Long doctorId;
        LocalDate appointmentDate;
        LocalTime appointmentTime;

        String paymentMethod =
                getString(request, "paymentMethod").toUpperCase();

        try {

            age = Integer.parseInt(request.get("age").toString());

            doctorId = Long.parseLong(
                    request.get("doctorId").toString()
            );

            appointmentDate = LocalDate.parse(
                    request.get("appointmentDate").toString()
            );

            appointmentTime = LocalTime.parse(
                    request.get("appointmentTime").toString()
            );

        } catch (Exception exception) {

            return errorResponse(
                    HttpStatus.BAD_REQUEST,
                    "Invalid age, doctor ID, date, or time."
            );
        }

        // ==========================================
        // VALIDATE PATIENT DETAILS
        // ==========================================

        if (fullName.isBlank()
                || email.isBlank()
                || gender.isBlank()) {

            return errorResponse(
                    HttpStatus.BAD_REQUEST,
                    "Patient name, email, and gender are required."
            );
        }

        if (age < 1 || age > 120) {

            return errorResponse(
                    HttpStatus.BAD_REQUEST,
                    "Patient age must be between 1 and 120."
            );
        }

        if (!gender.equalsIgnoreCase("Male")
                && !gender.equalsIgnoreCase("Female")
                && !gender.equalsIgnoreCase("Other")) {

            return errorResponse(
                    HttpStatus.BAD_REQUEST,
                    "Invalid gender selection."
            );
        }

        if (!email.matches("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$")) {

            return errorResponse(
                    HttpStatus.BAD_REQUEST,
                    "Please enter a valid email address."
            );
        }

        // ==========================================
        // VALIDATE DATE AND TIME
        // ==========================================

        if (appointmentDate.isBefore(LocalDate.now())) {

            return errorResponse(
                    HttpStatus.BAD_REQUEST,
                    "Appointment date cannot be in the past."
            );
        }

        if (appointmentDate.equals(LocalDate.now())
                && appointmentTime.isBefore(LocalTime.now())) {

            return errorResponse(
                    HttpStatus.BAD_REQUEST,
                    "Appointment time cannot be in the past."
            );
        }

        // ==========================================
        // VALIDATE PAYMENT METHOD
        // ==========================================

        if (!paymentMethod.equals("CASH")
                && !paymentMethod.equals("CARD")
                && !paymentMethod.equals("UPI")) {

            return errorResponse(
                    HttpStatus.BAD_REQUEST,
                    "Payment method must be Cash, Card, or UPI."
            );
        }

        // ==========================================
        // FIND DOCTOR
        // ==========================================

        Optional<Doctor> doctorOptional =
                doctorRepository.findById(doctorId);

        if (doctorOptional.isEmpty()) {

            return errorResponse(
                    HttpStatus.NOT_FOUND,
                    "Selected doctor was not found."
            );
        }

        Doctor doctor = doctorOptional.get();

        BigDecimal consultationFee =
                doctor.getConsultationFee();

        if (consultationFee == null
                || consultationFee.compareTo(BigDecimal.ZERO) <= 0) {

            return errorResponse(
                    HttpStatus.BAD_REQUEST,
                    "Doctor consultation fee is invalid."
            );
        }

        // ==========================================
        // FIND OR REGISTER PATIENT
        // ==========================================

        Patient patient;

        Optional<Patient> existingPatient =
                patientRepository.findByEmail(email);

        if (existingPatient.isPresent()) {

            patient = existingPatient.get();

            patient.setFullName(fullName);
            patient.setGender(gender);
            patient.setAge(age);

            patient = patientRepository.save(patient);

        } else {

            String generatedPassword =
                    UUID.randomUUID().toString();

            String encodedPassword =
                    passwordEncoder.encode(generatedPassword);

            patient = new Patient(
                    fullName,
                    email,
                    encodedPassword
            );

            patient.setGender(gender);
            patient.setAge(age);

            patient = patientRepository.save(patient);
        }

        // ==========================================
        // CREATE APPOINTMENT
        // ==========================================

        Appointment appointment = new Appointment();

        appointment.setPatient(patient);
        appointment.setDoctor(doctor);

        appointment.setAppointmentDate(appointmentDate);
        appointment.setAppointmentTime(appointmentTime);

        appointment.setAmount(consultationFee);
        appointment.setPaymentMethod(paymentMethod);

        appointment.setConfirmationEmailSent(false);
        appointment.setDoctorNotificationEmailSent(false);

        // ==========================================
        // CASH PAYMENT
        // ==========================================

        if (paymentMethod.equals("CASH")) {

            appointment.setPaymentStatus("PAID");
            appointment.setStatus("BOOKED");

            try {

                appointment =
                        appointmentService.bookAppointment(appointment);

            } catch (IllegalArgumentException exception) {

                return errorResponse(
                        HttpStatus.CONFLICT,
                        exception.getMessage()
                );
            }

            // Send confirmation only after payment is recorded.

            boolean emailSent =
                    sendPatientConfirmationEmail(appointment);

            Map<String, Object> response =
                    buildAppointmentResponse(appointment);

            response.put("status", "success");

            response.put(
                    "message",
                    "Walk-in appointment booked successfully."
            );

            response.put("emailSent", emailSent);

            response.put(
                    "emailMessage",
                    emailSent
                            ? "Appointment confirmation email sent successfully."
                            : "Appointment booked and payment recorded, but confirmation email could not be sent."
            );

            return ResponseEntity.ok(response);
        }

        // ==========================================
        // CARD / UPI PAYMENT
        // CREATE PENDING APPOINTMENT AND RAZORPAY ORDER
        // ==========================================

        appointment.setPaymentStatus("PENDING");
        appointment.setStatus("PENDING_PAYMENT");

        try {

            appointment =
                    appointmentService.bookAppointment(appointment);

        } catch (IllegalArgumentException exception) {

            return errorResponse(
                    HttpStatus.CONFLICT,
                    exception.getMessage()
            );
        }

        try {

            Map<String, Object> razorpayOrder =
                    paymentService.createOrder(appointment);

            Map<String, Object> response =
                    buildAppointmentResponse(appointment);

            response.put("status", "success");

            response.put(
                    "message",
                    "Appointment created. Complete Razorpay payment to confirm booking."
            );

            response.put("emailSent", false);

            response.put("razorpayOrder", razorpayOrder);

            return ResponseEntity.ok(response);

        } catch (Exception exception) {

            exception.printStackTrace();

            return errorResponse(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Unable to create Razorpay payment order. Please try again."
            );
        }
    }

    // ==========================================
    // VERIFY RAZORPAY PAYMENT
    // ==========================================

    @PostMapping("/verify-payment")
    @Transactional
    public ResponseEntity<?> verifyWalkInPayment(
            @RequestBody PaymentVerificationRequest request
    ) {

        if (!isReceptionistAuthenticated()) {

            return errorResponse(
                    HttpStatus.UNAUTHORIZED,
                    "Receptionist authentication required."
            );
        }

        if (request == null
                || request.getAppointmentId() == null
                || request.getRazorpayOrderId() == null
                || request.getRazorpayPaymentId() == null
                || request.getRazorpaySignature() == null) {

            return errorResponse(
                    HttpStatus.BAD_REQUEST,
                    "Missing Razorpay payment verification details."
            );
        }

        Optional<Appointment> appointmentOptional =
                appointmentRepository.findById(
                        request.getAppointmentId()
                );

        if (appointmentOptional.isEmpty()) {

            return errorResponse(
                    HttpStatus.NOT_FOUND,
                    "Appointment not found."
            );
        }

        Appointment appointment =
                appointmentOptional.get();

        // ==========================================
        // VERIFY PAYMENT USING EXISTING PAYMENT SERVICE
        // ==========================================

        try {

            appointment =
                    paymentService.verifyPayment(
                            appointment,
                            request
                    );

        } catch (IllegalArgumentException exception) {

            return errorResponse(
                    HttpStatus.BAD_REQUEST,
                    exception.getMessage()
            );

        } catch (Exception exception) {

            exception.printStackTrace();

            return errorResponse(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Payment verification failed. Please contact the receptionist."
            );
        }

        // ==========================================
        // SEND PATIENT EMAIL AFTER VERIFIED PAYMENT
        // ==========================================

        boolean emailSent =
                sendPatientConfirmationEmail(appointment);

        Map<String, Object> response =
                buildAppointmentResponse(appointment);

        response.put("status", "success");

        response.put(
                "message",
                "Payment verified and appointment booked successfully."
        );

        response.put("emailSent", emailSent);

        response.put(
                "emailMessage",
                emailSent
                        ? "Appointment confirmation email sent successfully."
                        : "Payment verified and appointment booked, but confirmation email could not be sent."
        );

        return ResponseEntity.ok(response);
    }

    // ==========================================
    // SEND PATIENT CONFIRMATION EMAIL
    // NO DOCTOR EMAIL
    // ==========================================

    private boolean sendPatientConfirmationEmail(
            Appointment appointment
    ) {

        if (Boolean.TRUE.equals(
                appointment.isConfirmationEmailSent()
        )) {

            System.out.println(
                    "PATIENT EMAIL ALREADY SENT FOR APPOINTMENT ID: "
                            + appointment.getId()
            );

            return true;
        }

        // FIX: Check payment status only.
        // Do not require appointment status to be exactly BOOKED.

        if (!"PAID".equalsIgnoreCase(
                appointment.getPaymentStatus()
        )) {

            System.err.println(
                    "PATIENT EMAIL SKIPPED: Payment is not PAID."
            );

            System.err.println(
                    "Appointment ID: " + appointment.getId()
            );

            System.err.println(
                    "Payment Status: " + appointment.getPaymentStatus()
            );

            System.err.println(
                    "Appointment Status: " + appointment.getStatus()
            );

            return false;
        }

        try {

            System.out.println("========================================");
            System.out.println("CURASYNC PATIENT EMAIL SENDING");
            System.out.println("Appointment ID: " + appointment.getId());

            System.out.println(
                    "Patient Email: " + appointment.getPatient().getEmail()
            );

            System.out.println(
                    "Payment Status: " + appointment.getPaymentStatus()
            );

            System.out.println(
                    "Appointment Status: " + appointment.getStatus()
            );

            emailService.sendAppointmentConfirmation(appointment);

            appointment.setConfirmationEmailSent(true);

            appointmentRepository.save(appointment);

            System.out.println(
                    "CURASYNC PATIENT EMAIL REQUEST SUCCESSFUL"
            );

            System.out.println("Appointment ID: " + appointment.getId());
            System.out.println("========================================");

            return true;

        } catch (Exception exception) {

            System.err.println("========================================");
            System.err.println("CURASYNC PATIENT EMAIL FAILED");

            System.err.println(
                    "Appointment ID: " + appointment.getId()
            );

            System.err.println(
                    "Patient Email: " + appointment.getPatient().getEmail()
            );

            System.err.println(
                    "Error: " + exception.getMessage()
            );

            exception.printStackTrace();

            System.err.println("========================================");

            return false;
        }
    }

    // ==========================================
    // BUILD APPOINTMENT RESPONSE
    // ==========================================

    private Map<String, Object> buildAppointmentResponse(
            Appointment appointment
    ) {

        Map<String, Object> response = new HashMap<>();

        Patient patient = appointment.getPatient();
        Doctor doctor = appointment.getDoctor();

        response.put("appointmentId", appointment.getId());

        response.put("patientName", patient.getFullName());
        response.put("patientEmail", patient.getEmail());

        response.put("gender", patient.getGender());
        response.put("age", patient.getAge());

        response.put("doctorName", doctor.getFullName());

        response.put(
                "department",
                doctor.getSpecialization()
        );

        response.put(
                "appointmentDate",
                appointment.getAppointmentDate()
        );

        response.put(
                "appointmentTime",
                appointment.getAppointmentTime()
        );

        response.put(
                "consultationFee",
                appointment.getAmount()
        );

        response.put(
                "paymentMethod",
                appointment.getPaymentMethod()
        );

        response.put(
                "paymentStatus",
                appointment.getPaymentStatus()
        );

        response.put(
                "appointmentStatus",
                appointment.getStatus()
        );

        return response;
    }

    // ==========================================
    // ERROR RESPONSE
    // ==========================================

    private ResponseEntity<?> errorResponse(
            HttpStatus status,
            String message
    ) {

        return ResponseEntity.status(status).body(
                Map.of(
                        "status", "error",
                        "message", message
                )
        );
    }

    // ==========================================
    // HELPER
    // ==========================================

    private String getString(
            Map<String, Object> request,
            String key
    ) {

        Object value = request.get(key);

        return value == null
                ? ""
                : value.toString().trim();
    }
}
