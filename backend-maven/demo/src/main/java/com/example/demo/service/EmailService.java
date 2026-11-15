package com.example.demo.service;

import com.example.demo.entity.Appointment;
import com.example.demo.entity.Doctor;
import com.example.demo.entity.Patient;

import org.json.JSONArray;
import org.json.JSONObject;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Service
public class EmailService {

    @Value("${RESEND_API_KEY:}")
    private String resendApiKey;

    @Value("${RESEND_FROM_EMAIL:onboarding@resend.dev}")
    private String fromEmail;

    private final HttpClient httpClient = HttpClient.newHttpClient();

    private static final DateTimeFormatter DATE_FORMAT =
            DateTimeFormatter.ofPattern("dd MMMM yyyy");

    private static final DateTimeFormatter TIME_FORMAT =
            DateTimeFormatter.ofPattern("hh:mm a");

    // PATIENT APPOINTMENT CONFIRMATION EMAIL

    public void sendAppointmentConfirmation(Appointment appointment) {

        Patient patient = appointment.getPatient();
        Doctor doctor = appointment.getDoctor();

        String patientName = escapeHtml(patient.getFullName());
        String doctorName = escapeHtml(doctor.getFullName());
        String specialization = escapeHtml(doctor.getSpecialization());

        String appointmentDate =
                appointment.getAppointmentDate().format(DATE_FORMAT);

        String appointmentTime =
                appointment.getAppointmentTime().format(TIME_FORMAT);

        String amount = formatAmount(appointment.getAmount());

        String html = """
                <!DOCTYPE html>
                <html>
                <body style="margin:0;padding:0;background:#f0fdf4;font-family:Arial,sans-serif;">
                    <div style="max-width:600px;margin:35px auto;background:#ffffff;border-radius:18px;overflow:hidden;">
                        <div style="background:linear-gradient(135deg,#064e3b,#059669);padding:35px;text-align:center;color:white;">
                            <h1 style="margin:0;font-size:28px;">CuraSync</h1>
                            <p style="color:#d1fae5;">Your health, connected.</p>
                        </div>

                        <div style="padding:30px;">
                            <h2 style="color:#065f46;">Appointment Confirmed!</h2>

                            <p>Hello <strong>%s</strong>,</p>

                            <p>Your appointment has been successfully booked and your payment has been verified.</p>

                            <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:14px;padding:22px;">
                                <h2 style="color:#065f46;">Dr. %s</h2>
                                <p><strong>Specialization:</strong> %s</p>
                                <p><strong>Date:</strong> %s</p>
                                <p><strong>Time:</strong> %s</p>
                                <p><strong>Appointment ID:</strong> #%s</p>
                            </div>

                            <div style="border:1px solid #e5e7eb;border-radius:12px;padding:18px;margin-top:20px;">
                                <p><strong>Consultation Fee:</strong> ₹%s</p>
                                <p style="color:#059669;font-weight:bold;">✓ PAYMENT SUCCESSFUL</p>
                            </div>

                            <p style="margin-top:25px;">Please arrive a few minutes before your scheduled appointment.</p>

                            <p>Thank you for choosing <strong>CuraSync</strong>.</p>
                        </div>

                        <div style="background:#064e3b;padding:20px;text-align:center;color:#d1fae5;">
                            <p>© CuraSync | Smart Hospital Management System</p>
                            <p style="font-size:11px;">Automated appointment confirmation email.</p>
                        </div>
                    </div>
                </body>
                </html>
                """.formatted(
                patientName,
                doctorName,
                specialization,
                appointmentDate,
                appointmentTime,
                appointment.getId(),
                amount
        );

        sendEmail(
                patient.getEmail(),
                "Appointment Confirmed | CuraSync",
                html,
                "curasync-appointment-confirmation-" + appointment.getId()
        );
    }

    // DOCTOR APPOINTMENT NOTIFICATION EMAIL

    public void sendDoctorAppointmentNotification(
            Appointment appointment) {

        Patient patient = appointment.getPatient();
        Doctor doctor = appointment.getDoctor();

        String doctorName = escapeHtml(doctor.getFullName());
        String patientName = escapeHtml(patient.getFullName());
        String patientEmail = escapeHtml(patient.getEmail());

        String specialization =
                escapeHtml(doctor.getSpecialization());

        String appointmentDate =
                appointment.getAppointmentDate().format(DATE_FORMAT);

        String appointmentTime =
                appointment.getAppointmentTime().format(TIME_FORMAT);

        String amount = formatAmount(appointment.getAmount());

        String html = """
                <!DOCTYPE html>
                <html>
                <body style="margin:0;padding:0;background:#eff6ff;font-family:Arial,sans-serif;">
                    <div style="max-width:600px;margin:35px auto;background:#ffffff;border-radius:18px;overflow:hidden;">

                        <div style="background:linear-gradient(135deg,#1e3a8a,#2563eb);padding:35px;text-align:center;color:white;">
                            <h1 style="margin:0;font-size:28px;">CuraSync</h1>
                            <p style="color:#dbeafe;">Doctor Appointment Notification</p>
                        </div>

                        <div style="padding:30px;">

                            <h2 style="color:#1e40af;">New Appointment Confirmed!</h2>

                            <p>Hello <strong>Dr. %s</strong>,</p>

                            <p>A patient has successfully booked an appointment with you. The payment has been verified.</p>

                            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;padding:22px;margin:25px 0;">

                                <p style="font-size:12px;color:#2563eb;font-weight:bold;letter-spacing:1px;">
                                    PATIENT DETAILS
                                </p>

                                <h2 style="color:#1e40af;">%s</h2>

                                <p><strong>Patient Email:</strong> %s</p>

                                <p><strong>Appointment ID:</strong> #%s</p>

                            </div>

                            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:22px;margin:25px 0;">

                                <p style="font-size:12px;color:#64748b;font-weight:bold;letter-spacing:1px;">
                                    APPOINTMENT DETAILS
                                </p>

                                <p><strong>Department:</strong> %s</p>

                                <p><strong>Date:</strong> %s</p>

                                <p><strong>Time:</strong> %s</p>

                                <p><strong>Consultation Fee:</strong> ₹%s</p>

                                <p style="color:#059669;font-weight:bold;">
                                    ✓ PAYMENT SUCCESSFUL
                                </p>

                            </div>

                            <p>Please check your CuraSync doctor dashboard for the appointment details.</p>

                            <p>Thank you for using <strong>CuraSync</strong>.</p>

                        </div>

                        <div style="background:#1e3a8a;padding:20px;text-align:center;color:#dbeafe;">
                            <p>© CuraSync | Smart Hospital Management System</p>
                            <p style="font-size:11px;">This is an automated doctor appointment notification.</p>
                        </div>

                    </div>
                </body>
                </html>
                """.formatted(
                doctorName,
                patientName,
                patientEmail,
                appointment.getId(),
                specialization,
                appointmentDate,
                appointmentTime,
                amount
        );

        sendEmail(
                doctor.getEmail(),
                "New Appointment Booked | CuraSync",
                html,
                "curasync-doctor-appointment-notification-" + appointment.getId()
        );
    }

    // COMMON RESEND EMAIL METHOD

    private void sendEmail(
            String recipient,
            String subject,
            String html,
            String idempotencyKey) {

        if (resendApiKey == null || resendApiKey.isBlank()) {
            throw new IllegalStateException("Resend API key is missing.");
        }

        if (recipient == null || recipient.isBlank()) {
            throw new IllegalArgumentException("Email recipient is missing.");
        }

        JSONObject emailRequest = new JSONObject();

        emailRequest.put(
                "from",
                "CuraSync <" + fromEmail + ">"
        );

        emailRequest.put(
                "to",
                new JSONArray().put(recipient)
        );

        emailRequest.put("subject", subject);
        emailRequest.put("html", html);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://api.resend.com/emails"))
                .header("Authorization", "Bearer " + resendApiKey)
                .header("Content-Type", "application/json")
                .header("User-Agent", "CuraSync/1.0")
                .header("Idempotency-Key", idempotencyKey)
                .POST(
                        HttpRequest.BodyPublishers.ofString(
                                emailRequest.toString()
                        )
                )
                .build();

        try {

            HttpResponse<String> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofString()
            );

            if (response.statusCode() < 200 ||
                    response.statusCode() >= 300) {

                throw new RuntimeException(
                        "Resend email failed. Status: "
                                + response.statusCode()
                                + ", Response: "
                                + response.body()
                );
            }

        } catch (InterruptedException e) {

            Thread.currentThread().interrupt();

            throw new RuntimeException(
                    "Email sending was interrupted.",
                    e
            );

        } catch (java.io.IOException e) {

            throw new RuntimeException(
                    "Unable to send email.",
                    e
            );
        }
    }

    // AMOUNT FORMATTER

    private String formatAmount(BigDecimal amount) {

        if (amount == null) {
            return "0.00";
        }

        return String.format(
                Locale.ROOT,
                "%.2f",
                amount
        );
    }

    // HTML ESCAPING

    private String escapeHtml(String value) {

        if (value == null) {
            return "";
        }

        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}