package com.example.demo;

import com.example.demo.entity.Appointment;
import com.example.demo.entity.Patient;
import com.example.demo.entity.Doctor;
import com.example.demo.entity.DepartmentFee;

import com.example.demo.repository.AppointmentRepository;
import com.example.demo.repository.DoctorRepository;
import com.example.demo.repository.PatientRepository;
import com.example.demo.repository.DepartmentFeeRepository;

import com.example.demo.service.PatientService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.Optional;

@RestController
@RequestMapping("/api/receptionist")
public class ReceptionistController {

    private final PasswordEncoder passwordEncoder;
    private final PatientService patientService;
    private final PatientRepository patientRepository;
    private final AppointmentRepository appointmentRepository;
    private final DoctorRepository doctorRepository;
    private final DepartmentFeeRepository departmentFeeRepository;

    @Value("${receptionist.email}")
    private String receptionistEmail;

    @Value("${receptionist.password}")
    private String receptionistPassword;

    public ReceptionistController(
            PasswordEncoder passwordEncoder,
            PatientService patientService,
            PatientRepository patientRepository,
            AppointmentRepository appointmentRepository,
            DoctorRepository doctorRepository,
            DepartmentFeeRepository departmentFeeRepository
    ) {
        this.passwordEncoder = passwordEncoder;
        this.patientService = patientService;
        this.patientRepository = patientRepository;
        this.appointmentRepository = appointmentRepository;
        this.doctorRepository = doctorRepository;
        this.departmentFeeRepository = departmentFeeRepository;
    }

    // =========================
    // RECEPTIONIST AUTH CHECK
    // =========================

    private boolean isReceptionistAuthenticated() {

        Authentication authentication =
                SecurityContextHolder.getContext().getAuthentication();

        return authentication != null
                && authentication.isAuthenticated()
                && authentication.getAuthorities().contains(
                        new SimpleGrantedAuthority("ROLE_RECEPTIONIST")
                );
    }

    // =========================
    // APPOINTMENT DTO
    // =========================

    private Map<String, Object> convertAppointmentToResponse(
            Appointment appointment
    ) {

        Map<String, Object> appointmentData = new HashMap<>();

        appointmentData.put("appointmentId", appointment.getId());

        appointmentData.put(
                "patientName",
                appointment.getPatient() != null
                        ? appointment.getPatient().getFullName()
                        : "Unknown Patient"
        );

        appointmentData.put(
                "patientEmail",
                appointment.getPatient() != null
                        ? appointment.getPatient().getEmail()
                        : ""
        );

        appointmentData.put(
                "doctorName",
                appointment.getDoctor() != null
                        ? appointment.getDoctor().getFullName()
                        : "Unknown Doctor"
        );

        appointmentData.put(
                "specialization",
                appointment.getDoctor() != null
                        ? appointment.getDoctor().getSpecialization()
                        : "N/A"
        );

        appointmentData.put(
                "appointmentDate",
                appointment.getAppointmentDate()
        );

        appointmentData.put(
                "appointmentTime",
                appointment.getAppointmentTime()
        );

        appointmentData.put(
                "status",
                appointment.getStatus()
        );

        appointmentData.put(
                "paymentStatus",
                appointment.getPaymentStatus()
        );

        appointmentData.put(
                "amount",
                appointment.getAmount() != null
                        ? appointment.getAmount()
                        : BigDecimal.ZERO
        );

        return appointmentData;
    }

    // =========================
    // RECEPTIONIST LOGIN
    // =========================

    @PostMapping("/login")
    public ResponseEntity<?> login(
            @RequestBody Map<String, String> request,
            HttpServletRequest httpServletRequest,
            HttpServletResponse httpServletResponse
    ) {

        String email = request.get("email");
        String password = request.get("password");

        if (email == null || password == null) {
            return ResponseEntity.badRequest().body(
                    Map.of(
                            "status", "error",
                            "message", "Email and password are required."
                    )
            );
        }

        if (
                !email.equalsIgnoreCase(receptionistEmail)
                        || !passwordEncoder.matches(
                                password,
                                passwordEncoder.encode(receptionistPassword)
                        )
        ) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                    Map.of(
                            "status", "error",
                            "message", "Invalid receptionist credentials."
                    )
            );
        }

        Authentication authentication =
                new UsernamePasswordAuthenticationToken(
                        receptionistEmail,
                        null,
                        List.of(
                                new SimpleGrantedAuthority("ROLE_RECEPTIONIST")
                        )
                );

        SecurityContext securityContext =
                SecurityContextHolder.createEmptyContext();

        securityContext.setAuthentication(authentication);

        SecurityContextHolder.setContext(securityContext);

        HttpSession session = httpServletRequest.getSession(true);

        HttpSessionSecurityContextRepository securityContextRepository =
                new HttpSessionSecurityContextRepository();

        securityContextRepository.saveContext(
                securityContext,
                httpServletRequest,
                httpServletResponse
        );

        return ResponseEntity.ok(
                Map.of(
                        "status", "success",
                        "message", "Receptionist login successful.",
                        "email", receptionistEmail,
                        "role", "RECEPTIONIST"
                )
        );
    }

    // =========================
    // RECEPTIONIST LOGOUT
    // =========================

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest request) {

        SecurityContextHolder.clearContext();

        HttpSession session = request.getSession(false);

        if (session != null) {
            session.invalidate();
        }

        return ResponseEntity.ok(
                Map.of(
                        "status", "success",
                        "message", "Receptionist logged out successfully."
                )
        );
    }

    // =========================
    // RECEPTIONIST SESSION
    // =========================

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentReceptionist(
            HttpServletRequest request
    ) {

        if (!isReceptionistAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                    Map.of(
                            "status", "error",
                            "message", "Receptionist is not authenticated."
                    )
            );
        }

        return ResponseEntity.ok(
                Map.of(
                        "status", "success",
                        "email", receptionistEmail,
                        "role", "RECEPTIONIST"
                )
        );
    }

    // =========================
    // LIVE RECEPTIONIST DASHBOARD
    // =========================

    @GetMapping("/dashboard-data")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getDashboardData() {

        if (!isReceptionistAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                    Map.of(
                            "status", "error",
                            "message", "Receptionist authentication required."
                    )
            );
        }

        LocalDate today = LocalDate.now();

        List<Appointment> allAppointments =
                appointmentRepository.findAll();

        List<Appointment> todaysAppointments =
                allAppointments.stream()
                        .filter(appointment ->
                                today.equals(appointment.getAppointmentDate())
                        )
                        .toList();

        BigDecimal todaysRevenue =
                todaysAppointments.stream()
                        .filter(appointment ->
                                "PAID".equalsIgnoreCase(
                                        appointment.getPaymentStatus()
                                )
                        )
                        .map(Appointment::getAmount)
                        .filter(amount -> amount != null)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<Map<String, Object>> appointmentResponses =
                todaysAppointments.stream()
                        .map(this::convertAppointmentToResponse)
                        .toList();

        Map<String, Object> dashboardData = new HashMap<>();

        dashboardData.put("status", "success");
        dashboardData.put("date", today);
        dashboardData.put(
                "totalAppointmentsToday",
                todaysAppointments.size()
        );
        dashboardData.put(
                "totalPatients",
                patientRepository.count()
        );
        dashboardData.put(
                "totalDoctors",
                doctorRepository.count()
        );
        dashboardData.put(
                "revenueToday",
                todaysRevenue
        );
        dashboardData.put(
                "appointments",
                appointmentResponses
        );

        return ResponseEntity.ok(dashboardData);
    }

    // =========================
    // APPOINTMENTS BY DATE
    // =========================

    @GetMapping("/appointments")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getAppointmentsByDate(
            @RequestParam String date
    ) {

        if (!isReceptionistAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                    Map.of(
                            "status", "error",
                            "message", "Receptionist authentication required."
                    )
            );
        }

        LocalDate selectedDate;

        try {
            selectedDate = LocalDate.parse(date);
        } catch (Exception exception) {
            return ResponseEntity.badRequest().body(
                    Map.of(
                            "status", "error",
                            "message", "Invalid date. Use YYYY-MM-DD format."
                    )
            );
        }

        List<Appointment> appointments =
                appointmentRepository.findAll()
                        .stream()
                        .filter(appointment ->
                                selectedDate.equals(
                                        appointment.getAppointmentDate()
                                )
                        )
                        .toList();

        List<Map<String, Object>> appointmentResponses =
                appointments.stream()
                        .map(this::convertAppointmentToResponse)
                        .toList();

        Map<String, Object> response = new HashMap<>();

        response.put("status", "success");
        response.put("date", selectedDate);
        response.put("count", appointmentResponses.size());
        response.put("appointments", appointmentResponses);

        return ResponseEntity.ok(response);
    }

    // =========================
    // GET ALL / SEARCH PATIENTS
    // =========================

    @GetMapping("/patients")
    public ResponseEntity<?> getPatients(
            @RequestParam(required = false) String search
    ) {

        if (!isReceptionistAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                    Map.of(
                            "status", "error",
                            "message", "Receptionist authentication required."
                    )
            );
        }

        List<Patient> patients;

        if (search == null || search.trim().isEmpty()) {
            patients = patientRepository.findAll();
        } else {
            String searchText = search.trim();

            patients =
                    patientRepository
                            .findByFullNameContainingIgnoreCaseOrEmailContainingIgnoreCase(
                                    searchText,
                                    searchText
                            );
        }

        List<Map<String, Object>> patientResponses =
                patients.stream()
                        .map(patient -> Map.<String, Object>of(
                                "id", patient.getId(),
                                "fullName", patient.getFullName(),
                                "email", patient.getEmail(),
                                "createdAt", patient.getCreatedAt()
                        ))
                        .toList();

        return ResponseEntity.ok(
                Map.of(
                        "status", "success",
                        "count", patientResponses.size(),
                        "patients", patientResponses
                )
        );
    }

    // =========================
    // REGISTER NEW PATIENT
    // =========================

    @PostMapping("/patients")
    public ResponseEntity<?> registerPatient(
            @RequestBody Map<String, String> request
    ) {

        if (!isReceptionistAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                    Map.of(
                            "status", "error",
                            "message", "Receptionist authentication required."
                    )
            );
        }

        String fullName = request.get("fullName");
        String email = request.get("email");
        String password = request.get("password");

        if (
                fullName == null
                        || fullName.trim().isEmpty()
                        || email == null
                        || email.trim().isEmpty()
                        || password == null
                        || password.trim().isEmpty()
        ) {
            return ResponseEntity.badRequest().body(
                    Map.of(
                            "status", "error",
                            "message", "Full name, email, and password are required."
                    )
            );
        }

        try {

            Patient patient = patientService.registerPatient(
                    fullName.trim(),
                    email.trim(),
                    password
            );

            return ResponseEntity.status(HttpStatus.CREATED).body(
                    Map.of(
                            "status", "success",
                            "message", "Patient registered successfully.",
                            "patient", Map.of(
                                    "id", patient.getId(),
                                    "fullName", patient.getFullName(),
                                    "email", patient.getEmail(),
                                    "createdAt", patient.getCreatedAt()
                            )
                    )
            );

        } catch (IllegalArgumentException exception) {

            return ResponseEntity.status(HttpStatus.CONFLICT).body(
                    Map.of(
                            "status", "error",
                            "message", exception.getMessage()
                    )
            );
        }
    }

    // =====================================================
    // CONSULTATION FEE MANAGEMENT
    // =====================================================

    // =========================
    // GET ALL CONSULTATION FEES
    // =========================

    @GetMapping("/fees")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getConsultationFees() {

        if (!isReceptionistAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                    Map.of(
                            "status", "error",
                            "message", "Receptionist authentication required."
                    )
            );
        }

        List<DepartmentFee> departmentFees =
                departmentFeeRepository.findAll();

        List<Map<String, Object>> departmentResponses =
                departmentFees.stream()
                        .map(department -> {
                            Map<String, Object> data = new HashMap<>();

                            data.put("id", department.getId());
                            data.put(
                                    "department",
                                    department.getDepartment()
                            );
                            data.put(
                                    "consultationFee",
                                    department.getConsultationFee()
                            );

                            return data;
                        })
                        .toList();

        List<Doctor> doctors = doctorRepository.findAll();

        List<Map<String, Object>> doctorResponses =
                doctors.stream()
                        .map(doctor -> {
                            Map<String, Object> data = new HashMap<>();

                            data.put("id", doctor.getId());
                            data.put(
                                    "fullName",
                                    doctor.getFullName()
                            );
                            data.put(
                                    "specialization",
                                    doctor.getSpecialization()
                            );
                            data.put(
                                    "consultationFee",
                                    doctor.getConsultationFee()
                            );
                            data.put(
                                    "feeOverride",
                                    doctor.isFeeOverride()
                            );

                            return data;
                        })
                        .toList();

        Map<String, Object> response = new HashMap<>();

        response.put("status", "success");
        response.put("departments", departmentResponses);
        response.put("doctors", doctorResponses);

        return ResponseEntity.ok(response);
    }

    // =========================
    // SET DEPARTMENT-WIDE FEE
    // =========================

    @PutMapping("/fees/department")
    @Transactional
    public ResponseEntity<?> setDepartmentFee(
            @RequestBody Map<String, Object> request
    ) {

        if (!isReceptionistAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                    Map.of(
                            "status", "error",
                            "message", "Receptionist authentication required."
                    )
            );
        }

        String departmentName =
                request.get("departmentName") != null
                        ? request.get("departmentName").toString().trim()
                        : "";

        BigDecimal fee;

        try {
            fee = new BigDecimal(
                    request.get("fee").toString()
            );
        } catch (Exception exception) {
            return ResponseEntity.badRequest().body(
                    Map.of(
                            "status", "error",
                            "message", "A valid consultation fee is required."
                    )
            );
        }

        if (departmentName.isEmpty()) {
            return ResponseEntity.badRequest().body(
                    Map.of(
                            "status", "error",
                            "message", "Department name is required."
                    )
            );
        }

        if (fee.compareTo(BigDecimal.ZERO) <= 0) {
            return ResponseEntity.badRequest().body(
                    Map.of(
                            "status", "error",
                            "message", "Consultation fee must be greater than zero."
                    )
            );
        }

        String normalizedDepartment =
                departmentName.toLowerCase();

        Optional<DepartmentFee> existingDepartmentFee =
                departmentFeeRepository.findByDepartmentIgnoreCase(
                        normalizedDepartment
                );

        DepartmentFee departmentFee;

        if (existingDepartmentFee.isPresent()) {
            departmentFee = existingDepartmentFee.get();
            departmentFee.setConsultationFee(fee);
        } else {
            departmentFee = new DepartmentFee(
                    normalizedDepartment,
                    fee
            );
        }

        departmentFeeRepository.save(departmentFee);

        // Update all doctors belonging to this department
        // who do not have an individual fee override.

        List<Doctor> doctors = doctorRepository.findAll();

        int updatedDoctors = 0;

        for (Doctor doctor : doctors) {

            if (
                    doctor.getSpecialization() != null
                            && doctor.getSpecialization()
                                    .trim()
                                    .equalsIgnoreCase(departmentName)
                            && !doctor.isFeeOverride()
            ) {
                doctor.setConsultationFee(fee);

                doctorRepository.save(doctor);

                updatedDoctors++;
            }
        }

        return ResponseEntity.ok(
                Map.of(
                        "status", "success",
                        "message", "Department consultation fee updated successfully.",
                        "department", departmentName,
                        "consultationFee", fee,
                        "updatedDoctors", updatedDoctors
                )
        );
    }

    // =========================
    // SET INDIVIDUAL DOCTOR FEE
    // =========================

    @PutMapping("/fees/doctor")
    @Transactional
    public ResponseEntity<?> setIndividualDoctorFee(
            @RequestBody Map<String, Object> request
    ) {

        if (!isReceptionistAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                    Map.of(
                            "status", "error",
                            "message", "Receptionist authentication required."
                    )
            );
        }

        Long doctorId;

        BigDecimal fee;

        try {
            doctorId = Long.valueOf(
                    request.get("doctorId").toString()
            );

            fee = new BigDecimal(
                    request.get("fee").toString()
            );

        } catch (Exception exception) {
            return ResponseEntity.badRequest().body(
                    Map.of(
                            "status", "error",
                            "message", "Valid doctor ID and consultation fee are required."
                    )
            );
        }

        if (fee.compareTo(BigDecimal.ZERO) <= 0) {
            return ResponseEntity.badRequest().body(
                    Map.of(
                            "status", "error",
                            "message", "Consultation fee must be greater than zero."
                    )
            );
        }

        Optional<Doctor> doctorOptional =
                doctorRepository.findById(doctorId);

        if (doctorOptional.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(
                    Map.of(
                            "status", "error",
                            "message", "Doctor not found."
                    )
            );
        }

        Doctor doctor = doctorOptional.get();

        doctor.setConsultationFee(fee);

        // Enable individual fee override
        doctor.setFeeOverride(true);

        doctorRepository.save(doctor);

        return ResponseEntity.ok(
                Map.of(
                        "status", "success",
                        "message", "Individual doctor consultation fee updated successfully.",
                        "doctorId", doctor.getId(),
                        "doctorName", doctor.getFullName(),
                        "consultationFee", doctor.getConsultationFee(),
                        "feeOverride", true
                )
        );
    }

    // =========================
    // RESET DOCTOR FEE OVERRIDE
    // =========================

    @PutMapping("/fees/doctor/{doctorId}/reset")
    @Transactional
    public ResponseEntity<?> resetDoctorFee(
            @PathVariable Long doctorId
    ) {

        if (!isReceptionistAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                    Map.of(
                            "status", "error",
                            "message", "Receptionist authentication required."
                    )
            );
        }

        Optional<Doctor> doctorOptional =
                doctorRepository.findById(doctorId);

        if (doctorOptional.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(
                    Map.of(
                            "status", "error",
                            "message", "Doctor not found."
                    )
            );
        }

        Doctor doctor = doctorOptional.get();

        Optional<DepartmentFee> departmentFeeOptional =
                departmentFeeRepository.findByDepartmentIgnoreCase(
                        doctor.getSpecialization()
                );

        BigDecimal newFee;

        if (departmentFeeOptional.isPresent()) {
            newFee = departmentFeeOptional.get()
                    .getConsultationFee();
        } else {
            newFee = new BigDecimal("500.00");
        }

        doctor.setConsultationFee(newFee);

        // Disable individual override
        doctor.setFeeOverride(false);

        doctorRepository.save(doctor);

        return ResponseEntity.ok(
                Map.of(
                        "status", "success",
                        "message", "Doctor fee reset to department default.",
                        "doctorId", doctor.getId(),
                        "doctorName", doctor.getFullName(),
                        "consultationFee", newFee,
                        "feeOverride", false
                )
        );
    }
}