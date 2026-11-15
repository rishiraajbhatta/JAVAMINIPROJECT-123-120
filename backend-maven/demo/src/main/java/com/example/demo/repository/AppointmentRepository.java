package com.example.demo.repository;

import com.example.demo.entity.Appointment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public interface AppointmentRepository extends JpaRepository<Appointment, Long> {

    List<Appointment> findByDoctorId(Long doctorId);

    List<Appointment> findByPatientId(Long patientId);

    List<Appointment> findByAppointmentDate(LocalDate appointmentDate);

    List<Appointment> findByAppointmentDateBetween(
            LocalDate startDate,
            LocalDate endDate
    );

    long countByAppointmentDate(LocalDate appointmentDate);

    List<Appointment> findByAppointmentDateAndPaymentStatusIgnoreCase(
            LocalDate appointmentDate,
            String paymentStatus
    );

    boolean existsByDoctorIdAndAppointmentDateAndAppointmentTimeAndStatus(
            Long doctorId,
            LocalDate appointmentDate,
            LocalTime appointmentTime,
            String status
    );
}