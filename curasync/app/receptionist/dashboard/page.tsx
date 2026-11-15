"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type WalkInRazorpayPaymentResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type WalkInRazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { name: string; email: string };
  theme: { color: string };
  handler: (response: WalkInRazorpayPaymentResponse) => void;
};

type WalkInRazorpayInstance = {
  open: () => void;
  on: (event: string, handler: (response: any) => void) => void;
};



function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(!!window.Razorpay);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const API_URL = "http://localhost:8080/api/receptionist";
const DOCTOR_API_URL = "http://localhost:8080/api/doctors";

const menuItems = [
  { name: "Overview", icon: "◫" },
  { name: "Appointments", icon: "▦" },
  { name: "Patients", icon: "♙" },
  { name: "Doctors", icon: "♧" },
  { name: "Consultation Fees", icon: "₹" },
  { name: "Payments", icon: "₹" },
];

type Patient = {
  id: number;
  fullName: string;
  email: string;
  createdAt: string;
};

type Doctor = {
  id: number;
  fullName: string;
  email: string;
  specialization: string;
  qualification: string;
  experienceYears: number;
  consultationFee: number;
  feeOverride?: boolean;
};

type DepartmentFee = {
  id?: number;
  departmentName: string;
  fee: number;
};

type Appointment = {
  appointmentId: number;
  patientName: string;
  patientEmail: string;
  doctorName: string;
  specialization: string;
  appointmentDate: string;
  appointmentTime: string;
  status: string;
  paymentStatus: string;
  amount: number;
};

type DashboardData = {
  date: string;
  totalAppointmentsToday: number;
  totalPatients: number;
  totalDoctors: number;
  revenueToday: number;
  appointments: Appointment[];
};

async function readApiResponse(response: Response): Promise<any> {
  const text = await response.text();

  if (!text.trim()) {
    throw new Error(
      response.status === 401 || response.status === 403
        ? "Your session has expired. Please log in again."
        : `The backend returned an empty response (HTTP ${response.status}).`
    );
  }

  let data: any;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `The backend returned an invalid response (HTTP ${response.status}).`
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Request failed with HTTP ${response.status}.`
    );
  }

  return data;
}

function getLocalDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getISTGreeting() {
  const currentHour = Number(
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date())
  );

  if (currentHour >= 5 && currentHour < 12) {
    return "Good Morning";
  }

  if (currentHour >= 12 && currentHour < 17) {
    return "Good Afternoon";
  }

  if (currentHour >= 17 && currentHour < 21) {
    return "Good Evening";
  }

  return "Good Night";
}

export default function ReceptionistDashboard() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState("Overview");
  const [search, setSearch] = useState("");

  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientSearch, setPatientSearch] = useState("");

  const [loadingPatients, setLoadingPatients] = useState(false);
  const [patientError, setPatientError] = useState("");

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [doctorError, setDoctorError] = useState("");
  const [doctorSearch, setDoctorSearch] = useState("");

  // WALK-IN APPOINTMENT BOOKING
  const [showWalkInForm, setShowWalkInForm] = useState(false);
  const [walkInFullName, setWalkInFullName] = useState("");
  const [walkInEmail, setWalkInEmail] = useState("");
  const [walkInGender, setWalkInGender] = useState("Male");
  const [walkInAge, setWalkInAge] = useState("");
  const [walkInDepartment, setWalkInDepartment] = useState("");
  const [walkInDoctorId, setWalkInDoctorId] = useState("");
  const [walkInDate, setWalkInDate] = useState(getLocalDateString(new Date()));
  const [walkInTime, setWalkInTime] = useState("09:00");
  const [walkInPaymentMethod, setWalkInPaymentMethod] = useState("CASH");
  const [savingWalkIn, setSavingWalkIn] = useState(false);
  const [walkInError, setWalkInError] = useState("");
  const [walkInSuccess, setWalkInSuccess] = useState<any>(null);
  const [pendingWalkInPayment, setPendingWalkInPayment] = useState<any>(null);

  // CONSULTATION FEE MANAGEMENT
  const [departmentFees, setDepartmentFees] = useState<DepartmentFee[]>([]);
  const [loadingFees, setLoadingFees] = useState(false);
  const [feeError, setFeeError] = useState("");
  const [feeMessage, setFeeMessage] = useState("");
  const [departmentNameInput, setDepartmentNameInput] = useState("");
  const [departmentFeeInput, setDepartmentFeeInput] = useState("");
  const [selectedFeeDoctorId, setSelectedFeeDoctorId] = useState("");
  const [individualDoctorFeeInput, setIndividualDoctorFeeInput] = useState("");
  const [savingDepartmentFee, setSavingDepartmentFee] = useState(false);
  const [savingDoctorFee, setSavingDoctorFee] = useState(false);
  const [resettingDoctorId, setResettingDoctorId] = useState<number | null>(null);

  // Department options include common hospital departments and any specializations
  // currently present in the registered-doctors list.
  const departmentOptions = Array.from(
    new Set(
      [
        "Cardiology",
        "Dermatology",
        "ENT",
        "Endocrinology",
        "Gastroenterology",
        "General Medicine",
        "General Surgery",
        "Gynecology",
        "Neurology",
        "Nephrology",
        "Oncology",
        "Ophthalmology",
        "Orthopedics",
        "Pediatrics",
        "Psychiatry",
        "Pulmonology",
        "Urology",
        ...doctors.map((doctor) => doctor.specialization?.trim() || ""),
      ].filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  const [dashboardData, setDashboardData] =
    useState<DashboardData | null>(null);

  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  const [showPatientForm, setShowPatientForm] = useState(false);

  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [patientPassword, setPatientPassword] = useState("");

  const [registeringPatient, setRegisteringPatient] = useState(false);

  const [registrationMessage, setRegistrationMessage] = useState("");
  const [registrationError, setRegistrationError] = useState("");

  // CALENDAR STATE

  const [selectedDate, setSelectedDate] = useState(
    getLocalDateString(new Date())
  );

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [dateAppointments, setDateAppointments] = useState<Appointment[]>([]);
  const [loadingDateAppointments, setLoadingDateAppointments] =
    useState(false);
  const [calendarError, setCalendarError] = useState("");

  // FETCH DASHBOARD DATA

  async function fetchDashboardData() {
    setLoadingDashboard(true);
    setDashboardError("");

    try {
      const response = await fetch(`${API_URL}/dashboard-data`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = await readApiResponse(response);

      if (!Array.isArray(data.appointments)) {
        data.appointments = [];
      }

      setDashboardData(data);
    } catch (error) {
      setDashboardError(
        error instanceof Error
          ? error.message
          : "Unable to connect to the backend."
      );
    } finally {
      setLoadingDashboard(false);
    }
  }

  // FETCH PATIENTS

  async function fetchPatients(searchTerm = "") {
    setLoadingPatients(true);
    setPatientError("");

    try {
      const query = searchTerm.trim()
        ? `?search=${encodeURIComponent(searchTerm.trim())}`
        : "";

      const response = await fetch(`${API_URL}/patients${query}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = await readApiResponse(response);

      const patientRecords = Array.isArray(data)
        ? data
        : Array.isArray(data.patients)
          ? data.patients
          : [];

      setPatients(patientRecords);
    } catch (error) {
      setPatientError(
        error instanceof Error
          ? error.message
          : "Unable to fetch patients."
      );
    } finally {
      setLoadingPatients(false);
    }
  }

  // FETCH REAL DOCTORS FROM JAVA BACKEND

  async function fetchDoctors() {
    setLoadingDoctors(true);
    setDoctorError("");

    try {
      const response = await fetch(DOCTOR_API_URL, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = await readApiResponse(response);

      const doctorRecords = Array.isArray(data)
        ? data
        : Array.isArray(data.doctors)
          ? data.doctors
          : [];

      setDoctors(doctorRecords);
    } catch (error) {
      setDoctorError(
        error instanceof Error
          ? error.message
          : "Unable to fetch doctors."
      );
    } finally {
      setLoadingDoctors(false);
    }
  }

  // FETCH DEPARTMENT AND DOCTOR FEE SETTINGS
  async function fetchFeeSettings() {
    setLoadingFees(true);
    setFeeError("");
    try {
      const response = await fetch(`${API_URL}/fees`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const data = await readApiResponse(response);

      const departmentRecords = Array.isArray(data)
        ? data
        : Array.isArray(data.departments)
          ? data.departments
          : Array.isArray(data.departmentFees)
            ? data.departmentFees
            : [];

      setDepartmentFees(
        departmentRecords.map((item: any) => ({
          id: item.id,
          departmentName: item.departmentName ?? item.department ?? item.name ?? "",
          fee: Number(item.fee ?? item.consultationFee ?? item.amount ?? 0),
        }))
      );

      // The doctors endpoint is the authoritative source for current fee values.
      await fetchDoctors();
    } catch (error) {
      setFeeError(
        error instanceof Error ? error.message : "Unable to load consultation fee settings."
      );
    } finally {
      setLoadingFees(false);
    }
  }

  async function handleSaveDepartmentFee(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const department = departmentNameInput.trim();
    const fee = Number(departmentFeeInput);

    if (!department || !Number.isFinite(fee) || fee <= 0) {
      setFeeError("Enter a department name and a valid fee greater than ₹0.");
      return;
    }

    setSavingDepartmentFee(true);
    setFeeError("");
    setFeeMessage("");
    try {
      const response = await fetch(`${API_URL}/fees/department`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departmentName: department, fee }),
      });
      const data = await readApiResponse(response);
      setFeeMessage(data.message || `Department fee for ${department} saved successfully.`);
      setDepartmentNameInput("");
      setDepartmentFeeInput("");
      await fetchFeeSettings();
    } catch (error) {
      setFeeError(error instanceof Error ? error.message : "Unable to save department fee.");
    } finally {
      setSavingDepartmentFee(false);
    }
  }

  async function handleSaveIndividualDoctorFee(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const doctorId = Number(selectedFeeDoctorId);
    const fee = Number(individualDoctorFeeInput);

    if (!doctorId || !Number.isFinite(fee) || fee <= 0) {
      setFeeError("Select a doctor and enter a valid fee greater than ₹0.");
      return;
    }

    setSavingDoctorFee(true);
    setFeeError("");
    setFeeMessage("");
    try {
      const response = await fetch(`${API_URL}/fees/doctor`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorId, fee }),
      });
      const data = await readApiResponse(response);
      setFeeMessage(data.message || "Individual doctor fee saved successfully.");
      setIndividualDoctorFeeInput("");
      await fetchFeeSettings();
    } catch (error) {
      setFeeError(error instanceof Error ? error.message : "Unable to save doctor fee.");
    } finally {
      setSavingDoctorFee(false);
    }
  }

  async function handleResetDoctorFee(doctorId: number) {
    setResettingDoctorId(doctorId);
    setFeeError("");
    setFeeMessage("");
    try {
      const response = await fetch(`${API_URL}/fees/doctor/${doctorId}/reset`, {
        method: "POST",
        credentials: "include",
      });
      const data = await readApiResponse(response);
      setFeeMessage(data.message || "Doctor fee override reset to the department fee.");
      await fetchFeeSettings();
    } catch (error) {
      setFeeError(error instanceof Error ? error.message : "Unable to reset doctor fee.");
    } finally {
      setResettingDoctorId(null);
    }
  }

  // FETCH APPOINTMENTS FOR SELECTED DATE

  async function fetchAppointmentsForDate(date: string) {
    setLoadingDateAppointments(true);
    setCalendarError("");
    setDateAppointments([]);

    try {
      const response = await fetch(
        `${API_URL}/appointments?date=${encodeURIComponent(date)}`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }
      );

      const data = await readApiResponse(response);

      const records = Array.isArray(data.appointments)
        ? data.appointments
        : Array.isArray(data)
          ? data
          : [];

      setDateAppointments(records);
    } catch (error) {
      setCalendarError(
        error instanceof Error
          ? error.message
          : "Unable to load appointments."
      );
    } finally {
      setLoadingDateAppointments(false);
    }
  }

  async function refreshWalkInData() {
    await fetchAppointmentsForDate(selectedDate);
    await fetchDashboardData();
    await fetchPatients();
  }

  async function openRazorpayCheckout(paymentData: any) {
    setWalkInError("");
    const scriptLoaded = await loadRazorpayScript();

    if (!scriptLoaded || !window.Razorpay) {
      setWalkInError("Unable to load Razorpay Checkout. Please check your internet connection and retry.");
      return;
    }

    const order = paymentData?.razorpayOrder;
    if (!order?.keyId || !order?.orderId || !order?.amount || !paymentData?.appointmentId) {
      setWalkInError("The payment order details are incomplete. Please contact the administrator.");
      return;
    }

    const RazorpayConstructor = (window as any).Razorpay as
  | (new (options: WalkInRazorpayOptions) => WalkInRazorpayInstance)
  | undefined;

if (!RazorpayConstructor) {
  setWalkInError("Razorpay Checkout could not be loaded. Please try again.");
  return;
}

const checkout = new RazorpayConstructor ({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency || "INR",
      name: "CuraSync Hospital",
      description: `Walk-in appointment #${paymentData.appointmentId}`,
      order_id: order.orderId,
      prefill: {
        name: paymentData.patientName || walkInFullName.trim(),
        email: paymentData.patientEmail || walkInEmail.trim(),
      },
      theme: { color: "#2563eb" },
      handler: async (paymentResponse: WalkInRazorpayPaymentResponse) => {
        setSavingWalkIn(true);
        try {
          const verificationResponse = await fetch(`${API_URL}/walk-in-appointments/verify-payment`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              appointmentId: paymentData.appointmentId,
              razorpayOrderId: paymentResponse.razorpay_order_id,
              razorpayPaymentId: paymentResponse.razorpay_payment_id,
              razorpaySignature: paymentResponse.razorpay_signature,
            }),
          });

          const verifiedData = await readApiResponse(verificationResponse);
          setWalkInSuccess(verifiedData);
          setPendingWalkInPayment(null);
          setWalkInFullName("");
          setWalkInEmail("");
          setWalkInGender("Male");
          setWalkInAge("");
          setWalkInDepartment("");
          setWalkInDoctorId("");
          setWalkInDate(getLocalDateString(new Date()));
          setWalkInTime("09:00");
          setWalkInPaymentMethod("CASH");
          await refreshWalkInData();
        } catch (error) {
          setWalkInError(error instanceof Error ? error.message : "Payment verification failed. Please contact the administrator.");
        } finally {
          setSavingWalkIn(false);
        }
      },
    });

    checkout.on("payment.failed", (failure: any) => {
      setWalkInError(failure?.error?.description || "Payment failed or was cancelled. You can retry the payment.");
    });

    checkout.open();
  }

  async function handleWalkInBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingWalkIn(true);
    setWalkInError("");
    setWalkInSuccess(null);

    try {
      const response = await fetch(`${API_URL}/walk-in-appointments/book`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: walkInFullName.trim(),
          email: walkInEmail.trim(),
          gender: walkInGender,
          age: Number(walkInAge),
          doctorId: Number(walkInDoctorId),
          appointmentDate: walkInDate,
          appointmentTime: walkInTime,
          paymentMethod: walkInPaymentMethod,
        }),
      });
      const data = await readApiResponse(response);

      if (walkInPaymentMethod === "CARD" || walkInPaymentMethod === "UPI") {
        setPendingWalkInPayment(data);
        await openRazorpayCheckout(data);
        return;
      }

      setWalkInSuccess(data);
      setWalkInFullName("");
      setWalkInEmail("");
      setWalkInGender("Male");
      setWalkInAge("");
      setWalkInDepartment("");
      setWalkInDoctorId("");
      setWalkInDate(getLocalDateString(new Date()));
      setWalkInTime("09:00");
      setWalkInPaymentMethod("CASH");
      await refreshWalkInData();
    } catch (error) {
      setWalkInError(error instanceof Error ? error.message : "Unable to book the walk-in appointment.");
    } finally {
      setSavingWalkIn(false);
    }
  }

  // INITIAL LOAD

  useEffect(() => {
    fetchPatients();
    fetchDashboardData();
  }, []);

  // LOAD DOCTORS WHEN DOCTORS TAB OPENS

  useEffect(() => {
    if (activeTab === "Doctors") {
      fetchDoctors();
    }
    if (activeTab === "Consultation Fees") {
      fetchFeeSettings();
    }
  }, [activeTab]);

  // LOAD APPOINTMENTS WHEN DATE CHANGES

  useEffect(() => {
    if (activeTab !== "Appointments") return;

    fetchAppointmentsForDate(selectedDate);
  }, [selectedDate, activeTab]);

  // PATIENT SEARCH

  useEffect(() => {
    if (activeTab !== "Patients") return;

    const timeout = setTimeout(() => {
      fetchPatients(patientSearch);
    }, 300);

    return () => clearTimeout(timeout);
  }, [patientSearch, activeTab]);

  // REGISTER PATIENT

  async function handleRegisterPatient(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setRegisteringPatient(true);
    setRegistrationMessage("");
    setRegistrationError("");

    try {
      const response = await fetch(`${API_URL}/patients`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: patientName,
          email: patientEmail,
          password: patientPassword,
        }),
      });

      const data = await readApiResponse(response);

      setRegistrationMessage(
        data.message || "Patient registered successfully!"
      );

      setPatientName("");
      setPatientEmail("");
      setPatientPassword("");

      setShowPatientForm(false);

      await fetchPatients(patientSearch);
      await fetchDashboardData();
    } catch (error) {
      setRegistrationError(
        error instanceof Error
          ? error.message
          : "Unable to register patient."
      );
    } finally {
      setRegisteringPatient(false);
    }
  }

  // LOGOUT

  async function handleLogout() {
    try {
      await fetch(`${API_URL}/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    }

    router.push("/receptionist");
  }

  // CALENDAR NAVIGATION

  function goToPreviousMonth() {
    setCalendarMonth(
      new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth() - 1,
        1
      )
    );
  }

  function goToNextMonth() {
    setCalendarMonth(
      new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth() + 1,
        1
      )
    );
  }

  function goToToday() {
    const today = new Date();

    setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(getLocalDateString(today));
  }

  function selectCalendarDate(date: string) {
    setSelectedDate(date);
    setSearch("");
  }

  // CALENDAR GRID

  const calendarYear = calendarMonth.getFullYear();
  const calendarMonthIndex = calendarMonth.getMonth();

  const firstDayOfMonth = new Date(
    calendarYear,
    calendarMonthIndex,
    1
  ).getDay();

  const daysInMonth = new Date(
    calendarYear,
    calendarMonthIndex + 1,
    0
  ).getDate();

  const calendarCells: (number | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  while (calendarCells.length % 7 !== 0) {
    calendarCells.push(null);
  }

  const todayDate = getLocalDateString(new Date());

  // FORMATTING HELPERS

  function formatDate(date: string) {
    if (!date) return "—";

    return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatTime(time: string) {
    if (!time) return "—";

    const parts = time.split(":");
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);

    const formattedTime = new Date();
    formattedTime.setHours(hours, minutes, 0, 0);

    return formattedTime.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  function formatCurrency(amount: number) {
    return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
  }

  function formatStatus(status: string) {
    if (!status) return "Unknown";

    return status
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  function isConfirmed(status: string) {
    return ["CONFIRMED", "BOOKED", "COMPLETED"].includes(
      status?.toUpperCase()
    );
  }

  function isPaid(paymentStatus: string) {
    return paymentStatus?.toUpperCase() === "PAID";
  }

  // FILTER APPOINTMENTS

  const appointments = dashboardData?.appointments || [];

  const filteredAppointments = appointments.filter((appointment) =>
    `${appointment.patientName || ""} ${
      appointment.doctorName || ""
    } ${appointment.appointmentId || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const filteredDateAppointments = dateAppointments.filter((appointment) =>
    `${appointment.patientName || ""} ${
      appointment.doctorName || ""
    } ${appointment.appointmentId || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  // FILTER DOCTORS

  const filteredDoctors = doctors.filter((doctor) =>
    `${doctor.fullName || ""} ${doctor.email || ""} ${
      doctor.specialization || ""
    } ${doctor.qualification || ""}`
      .toLowerCase()
      .includes(doctorSearch.toLowerCase())
  );

  // APPOINTMENT TABLE

  function renderAppointmentTable(records: Appointment[]) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
          <thead className="bg-blue-50/60">
            <tr className="text-xs uppercase tracking-wider text-gray-400">
              <th className="px-6 py-4">Patient</th>
              <th className="px-6 py-4">Doctor</th>
              <th className="px-6 py-4">Date & Time</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Payment</th>
              <th className="px-6 py-4">Amount</th>
              <th className="px-6 py-4">Appointment ID</th>
            </tr>
          </thead>

          <tbody>
            {records.map((appointment) => (
              <tr
                key={appointment.appointmentId}
                className="border-t border-blue-50 transition hover:bg-blue-50/40"
              >
                <td className="px-6 py-5">
                  <p className="text-sm font-semibold text-blue-950">
                    {appointment.patientName || "Unknown Patient"}
                  </p>

                  <p className="mt-1 text-xs text-gray-400">
                    {appointment.patientEmail || "—"}
                  </p>
                </td>

                <td className="px-6 py-5">
                  <p className="text-sm font-medium text-blue-950">
                    {appointment.doctorName || "Unknown Doctor"}
                  </p>

                  <p className="mt-1 text-xs text-gray-400">
                    {appointment.specialization || "—"}
                  </p>
                </td>

                <td className="px-6 py-5">
                  <p className="text-sm font-medium text-blue-950">
                    {formatDate(appointment.appointmentDate)}
                  </p>

                  <p className="mt-1 text-xs text-gray-400">
                    {formatTime(appointment.appointmentTime)}
                  </p>
                </td>

                <td className="px-6 py-5">
                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      isConfirmed(appointment.status)
                        ? "bg-blue-100 text-blue-700"
                        : appointment.status?.toUpperCase() === "CANCELLED"
                          ? "bg-red-100 text-red-600"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {formatStatus(appointment.status)}
                  </span>
                </td>

                <td className="px-6 py-5">
                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      isPaid(appointment.paymentStatus)
                        ? "bg-cyan-100 text-cyan-700"
                        : "bg-red-100 text-red-600"
                    }`}
                  >
                    {formatStatus(appointment.paymentStatus)}
                  </span>
                </td>

                <td className="px-6 py-5 text-sm font-semibold text-blue-950">
                  {formatCurrency(appointment.amount)}
                </td>

                <td className="px-6 py-5 text-sm text-gray-400">
                  APT-{appointment.appointmentId}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Your existing dashboard JSX continues here
  return (
    <div className="min-h-screen bg-[#f3f7fc] text-[#172b4d]">
      <div className="flex min-h-screen">
        {/* SIDEBAR */}

        <aside className="hidden w-[260px] flex-col border-r border-blue-100 bg-white px-6 py-8 lg:flex">
          <div className="mb-12 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-2xl text-white shadow-lg shadow-blue-200">
              ✚
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-blue-900">
                CuraSync
              </h1>

              <p className="text-xs tracking-wide text-gray-400">
                HOSPITAL MANAGEMENT
              </p>
            </div>
          </div>

          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
            Workspace
          </p>

          <nav className="space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.name}
                onClick={() => setActiveTab(item.name)}
                className={`flex w-full items-center gap-4 rounded-xl px-4 py-3.5 text-left text-sm font-medium transition ${
                  activeTab === item.name
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-100"
                    : "text-gray-500 hover:bg-blue-50 hover:text-blue-700"
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                {item.name}
              </button>
            ))}
          </nav>

          <div className="mt-auto rounded-2xl bg-blue-50 p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-xl text-blue-700">
              ♡
            </div>

            <h3 className="font-semibold text-blue-900">CuraSync Care</h3>

            <p className="mt-2 text-xs leading-5 text-blue-700">
              Simplifying hospital operations with intelligent healthcare
              management.
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="mt-6 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-500 transition hover:bg-red-50"
          >
            ↪ Sign Out
          </button>
        </aside>

        {/* MAIN CONTENT */}

        <main className="flex-1 overflow-hidden px-5 py-7 md:px-10 lg:px-12">
          {/* HEADER */}

          <header className="mb-9 flex flex-wrap items-center justify-between gap-5">
            <div>
              <p className="mb-2 text-sm text-gray-400">
                CuraSync / Receptionist
              </p>

              <h1 className="text-3xl font-bold tracking-tight text-blue-950 md:text-4xl">
                {activeTab === "Overview"
  ? `${getISTGreeting()}, Receptionist`
  : activeTab}

                <span className="ml-2 text-blue-500">✦</span>
              </h1>

              <p className="mt-2 text-sm text-gray-500">
                Manage your hospital operations from one place.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden rounded-xl border border-blue-100 bg-white px-4 py-3 sm:block">
                <p className="text-xs text-gray-400">Today</p>

                <p className="text-sm font-semibold text-blue-900">
                  {new Date().toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 font-bold text-blue-700">
                R
              </div>
            </div>
          </header>

          {/* MOBILE NAV */}

          <div className="mb-6 flex gap-2 overflow-x-auto lg:hidden">
            {menuItems.map((item) => (
              <button
                key={item.name}
                onClick={() => setActiveTab(item.name)}
                className={`whitespace-nowrap rounded-xl px-4 py-3 text-sm font-medium ${
                  activeTab === item.name
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-500"
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>

          {/* DASHBOARD ERROR */}

          {dashboardError && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
              <span>Unable to load dashboard data: {dashboardError}</span>

              <button
                onClick={fetchDashboardData}
                className="rounded-lg bg-red-100 px-4 py-2 font-semibold text-red-700"
              >
                Retry
              </button>
            </div>
          )}

          {/* OVERVIEW */}

          {activeTab === "Overview" && (
            <>
              <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    title: "Total Appointments",
                    value: loadingDashboard
                      ? "..."
                      : (
                          dashboardData?.totalAppointmentsToday ?? 0
                        ).toLocaleString("en-IN"),
                    change: "Today's schedule",
                    icon: "▦",
                    color: "bg-blue-100 text-blue-700",
                  },
                  {
                    title: "Registered Patients",
                    value: loadingDashboard
                      ? "..."
                      : (
                          dashboardData?.totalPatients ?? 0
                        ).toLocaleString("en-IN"),
                    change: "Real patient records",
                    icon: "♙",
                    color: "bg-cyan-100 text-cyan-700",
                  },
                  {
                    title: "Registered Doctors",
                    value: loadingDashboard
                      ? "..."
                      : (
                          dashboardData?.totalDoctors ?? doctors.length
                        ).toLocaleString("en-IN"),
                    change: "Registered doctors",
                    icon: "♧",
                    color: "bg-indigo-100 text-indigo-700",
                  },
                  {
                    title: "Today's Revenue",
                    value: loadingDashboard
                      ? "..."
                      : formatCurrency(dashboardData?.revenueToday ?? 0),
                    change: "Paid appointments today",
                    icon: "₹",
                    color: "bg-sky-100 text-sky-700",
                  },
                ].map((stat) => (
                  <div
                    key={stat.title}
                    className="rounded-2xl border border-blue-50 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                  >
                    <div className="mb-5 flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-500">
                        {stat.title}
                      </p>

                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl ${stat.color}`}
                      >
                        {stat.icon}
                      </div>
                    </div>

                    <h2 className="text-3xl font-bold tracking-tight text-blue-950">
                      {stat.value}
                    </h2>

                    <p className="mt-2 text-xs text-gray-400">
                      {stat.change}
                    </p>
                  </div>
                ))}
              </div>

              {/* QUICK ACTIONS */}

              <div className="mb-8 rounded-2xl border border-blue-50 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold text-blue-950">
                  Quick Actions
                </h2>

                <p className="mt-1 text-sm text-gray-400">
                  Frequently used receptionist operations.
                </p>

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    {
                      title: "Book Appointment",
                      description: "Schedule a patient visit",
                      icon: "＋",
                      tab: "Appointments",
                    },
                    {
                      title: "Register Patient",
                      description: "Create a patient profile",
                      icon: "♙",
                      tab: "Patients",
                    },
                    {
                      title: "View Doctors",
                      description: "View registered doctors",
                      icon: "♧",
                      tab: "Doctors",
                    },
                    {
                      title: "Collect Payment",
                      description: "Record a patient payment",
                      icon: "₹",
                      tab: "Payments",
                    },
                  ].map((action) => (
                    <button
                      key={action.title}
                      onClick={() => setActiveTab(action.tab)}
                      className="rounded-xl border border-blue-50 p-5 text-left transition hover:border-blue-200 hover:bg-blue-50"
                    >
                      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-2xl text-blue-700">
                        {action.icon}
                      </div>

                      <h3 className="font-semibold text-blue-950">
                        {action.title}
                      </h3>

                      <p className="mt-1 text-xs text-gray-400">
                        {action.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* TODAY'S APPOINTMENTS */}

              <div className="overflow-hidden rounded-2xl border border-blue-50 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-blue-50 p-6">
                  <div>
                    <h2 className="text-xl font-bold text-blue-950">
                      Today's Appointments
                    </h2>

                    <p className="mt-1 text-sm text-gray-400">
                      Live appointments retrieved from the database.
                    </p>
                  </div>

                  <input
                    type="text"
                    placeholder="Search patient or doctor..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm outline-none focus:border-blue-500 sm:w-64"
                  />
                </div>

                {renderAppointmentTable(filteredAppointments)}

                {loadingDashboard && (
                  <div className="p-10 text-center text-sm text-blue-600">
                    Loading appointments...
                  </div>
                )}

                {!loadingDashboard &&
                  filteredAppointments.length === 0 &&
                  !dashboardError && (
                    <div className="p-10 text-center text-sm text-gray-400">
                      No appointments found for today.
                    </div>
                  )}
              </div>
            </>
          )}

          {/* APPOINTMENTS CALENDAR */}

          {activeTab === "Appointments" && (
            <>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 p-6 shadow-sm">
                <div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-blue-500">Walk-in patient</p>
                  <h2 className="text-xl font-bold text-blue-950">Book an appointment at reception</h2>
                  <p className="mt-1 text-sm text-gray-500">Register patient details, collect the fee, and send a confirmation email.</p>
                </div>
                <button
                  onClick={() => { setShowWalkInForm((value) => !value); setWalkInError(""); setWalkInSuccess(null); fetchDoctors(); }}
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700"
                >
                  {showWalkInForm ? "Close Booking Form" : "+ New Walk-in Booking"}
                </button>
              </div>

              {showWalkInForm && (
                <div className="mb-8 rounded-2xl border border-blue-100 bg-white p-6 shadow-md sm:p-8">
                  {walkInSuccess ? (
                    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-7">
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-3xl text-emerald-700">✓</div>
                      <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Payment successful · {walkInSuccess.paymentMethod}</p>
                      <h3 className="mt-2 text-2xl font-bold text-emerald-950">Appointment Booked Successfully!</h3>
                      <p className="mt-2 text-sm text-emerald-800">Appointment #{walkInSuccess.appointmentId} for {walkInSuccess.patientName} with {walkInSuccess.doctorName}.</p>
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl bg-white p-4"><p className="text-xs text-gray-500">Date & time</p><p className="mt-1 font-semibold text-gray-900">{walkInSuccess.appointmentDate} · {walkInSuccess.appointmentTime}</p></div>
                        <div className="rounded-xl bg-white p-4"><p className="text-xs text-gray-500">Consultation fee</p><p className="mt-1 font-semibold text-gray-900">₹{Number(walkInSuccess.consultationFee).toLocaleString("en-IN")}</p></div>
                      </div>
                      <p className={`mt-4 text-sm font-medium ${walkInSuccess.emailSent ? "text-emerald-700" : "text-amber-700"}`}>{walkInSuccess.emailSent ? `✉ Confirmation email sent to ${walkInSuccess.patientEmail}` : `Booking is confirmed, but email was not sent: ${walkInSuccess.emailMessage || "Please verify email service configuration."}`}</p>
                      <button onClick={() => setWalkInSuccess(null)} className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700">Book Another Walk-in</button>
                    </div>
                  ) : pendingWalkInPayment ? (
                    <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-7">
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-3xl text-amber-700">₹</div>
                      <p className="text-xs font-bold uppercase tracking-widest text-amber-700">Payment pending · {pendingWalkInPayment.paymentMethod}</p>
                      <h3 className="mt-2 text-2xl font-bold text-amber-950">Complete the appointment payment</h3>
                      <p className="mt-2 text-sm text-amber-800">Appointment #{pendingWalkInPayment.appointmentId} for {pendingWalkInPayment.patientName} with {pendingWalkInPayment.doctorName}. The appointment will be confirmed after payment verification.</p>
                      <p className="mt-4 text-xl font-bold text-amber-950">₹{Number(pendingWalkInPayment.consultationFee || pendingWalkInPayment.amount || 0).toLocaleString("en-IN")}</p>
                      {walkInError && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{walkInError}</div>}
                      <div className="mt-5 flex flex-wrap gap-3">
                        <button type="button" disabled={savingWalkIn} onClick={() => openRazorpayCheckout(pendingWalkInPayment)} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{savingWalkIn ? "Processing..." : "Retry Payment"}</button>
                        <button type="button" onClick={() => { setPendingWalkInPayment(null); setWalkInError(""); }} className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50">Back to Form</button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleWalkInBooking} className="space-y-6">
                      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-bold text-blue-950">Patient & appointment details</h3><p className="mt-1 text-sm text-gray-500">All fields are required. Payment is recorded as paid when booking completes.</p></div><span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">RECEPTION DESK</span></div>
                      {walkInError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{walkInError}</div>}
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <label className="text-sm font-medium text-gray-700">Patient full name<input required value={walkInFullName} onChange={(e) => setWalkInFullName(e.target.value)} placeholder="Enter patient's name" className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
                        <label className="text-sm font-medium text-gray-700">Patient email<input required type="email" value={walkInEmail} onChange={(e) => setWalkInEmail(e.target.value)} placeholder="patient@example.com" className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
                        <label className="text-sm font-medium text-gray-700">Gender<select required value={walkInGender} onChange={(e) => setWalkInGender(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-500"><option>Male</option><option>Female</option><option>Other</option></select></label>
                        <label className="text-sm font-medium text-gray-700">Age<input required type="number" min="1" max="120" value={walkInAge} onChange={(e) => setWalkInAge(e.target.value)} placeholder="Age in years" className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500" /></label>
                        <label className="text-sm font-medium text-gray-700">Department<select required value={walkInDepartment} onChange={(e) => { setWalkInDepartment(e.target.value); setWalkInDoctorId(""); }} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-500"><option value="">Select department</option>{departmentOptions.map((department) => <option key={department} value={department}>{department}</option>)}</select></label>
                        <label className="text-sm font-medium text-gray-700">Doctor<select required value={walkInDoctorId} onChange={(e) => setWalkInDoctorId(e.target.value)} disabled={!walkInDepartment} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-500 disabled:bg-gray-50"><option value="">Select doctor</option>{doctors.filter((doctor) => doctor.specialization?.trim() === walkInDepartment).map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.fullName}</option>)}</select></label>
                        <label className="text-sm font-medium text-gray-700">Appointment date<input required type="date" min={getLocalDateString(new Date())} value={walkInDate} onChange={(e) => setWalkInDate(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500" /></label>
                        <label className="text-sm font-medium text-gray-700">Appointment time<input required type="time" value={walkInTime} onChange={(e) => setWalkInTime(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-blue-500" /></label>
                        <label className="text-sm font-medium text-gray-700">Payment method<select required value={walkInPaymentMethod} onChange={(e) => setWalkInPaymentMethod(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-500"><option value="CASH">Cash</option><option value="CARD">Card</option><option value="UPI">UPI</option></select></label>
                      </div>
                      {walkInDoctorId && (() => { const selectedDoctor = doctors.find((doctor) => String(doctor.id) === walkInDoctorId); return selectedDoctor ? <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-5"><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-500">Consultation fee</p><p className="mt-1 text-3xl font-bold text-blue-950">₹{Number(selectedDoctor.consultationFee || 0).toLocaleString("en-IN")}</p><p className="mt-1 text-sm text-blue-700">{selectedDoctor.fullName} · {selectedDoctor.specialization}</p></div><p className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-emerald-700">✓ Collect payment before confirming</p></div> : null; })()}
                      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 pt-5"><button type="button" onClick={() => setShowWalkInForm(false)} className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button><button type="submit" disabled={savingWalkIn || !walkInDoctorId} className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{savingWalkIn ? "Preparing payment..." : walkInPaymentMethod === "CASH" ? "✓ Record Cash & Book" : "✓ Proceed to Online Payment"}</button></div>
                    </form>
                  )}
                </div>
              )}

              <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-50 bg-white p-6 shadow-sm">
                <div>
                  <h2 className="text-xl font-bold text-blue-950">
                    Appointment Calendar
                  </h2>

                  <p className="mt-1 text-sm text-gray-400">
                    Select any date to view its real patient appointments.
                  </p>
                </div>

                <button
                  onClick={() => fetchAppointmentsForDate(selectedDate)}
                  className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                >
                  ↻ Refresh Selected Date
                </button>
              </div>

              <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.2fr]">
                {/* CALENDAR */}

                <div className="rounded-2xl border border-blue-50 bg-white p-5 shadow-sm sm:p-7">
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-xl font-bold text-blue-950">
                      {calendarMonth.toLocaleDateString("en-IN", {
                        month: "long",
                        year: "numeric",
                      })}
                    </h2>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={goToToday}
                        className="rounded-lg border border-blue-100 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                      >
                        Today
                      </button>

                      <button
                        onClick={goToPreviousMonth}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-100 text-blue-700"
                      >
                        ←
                      </button>

                      <button
                        onClick={goToNextMonth}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-100 text-blue-700"
                      >
                        →
                      </button>
                    </div>
                  </div>

                  <div className="mb-2 grid grid-cols-7">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                      (day) => (
                        <div
                          key={day}
                          className="py-3 text-center text-xs font-semibold text-gray-400"
                        >
                          {day}
                        </div>
                      )
                    )}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {calendarCells.map((day, index) => {
                      if (day === null) {
                        return (
                          <div
                            key={`empty-${index}`}
                            className="h-12 sm:h-14"
                          />
                        );
                      }

                      const dateString = getLocalDateString(
                        new Date(calendarYear, calendarMonthIndex, day)
                      );

                      const isSelected = dateString === selectedDate;
                      const isToday = dateString === todayDate;

                      return (
                        <button
                          key={dateString}
                          onClick={() => selectCalendarDate(dateString)}
                          className={`relative flex h-12 flex-col items-center justify-center rounded-xl text-sm transition sm:h-14 ${
                            isSelected
                              ? "bg-blue-600 font-bold text-white shadow-md"
                              : isToday
                                ? "border border-blue-300 bg-blue-50 font-bold text-blue-700"
                                : "text-gray-600 hover:bg-blue-50"
                          }`}
                        >
                          {day}

                          {isToday && !isSelected && (
                            <span className="absolute bottom-1 h-1 w-1 rounded-full bg-blue-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-6 border-t border-blue-50 pt-5 text-xs text-gray-400">
                    Select a date to view appointments.
                  </div>
                </div>

                {/* DATE APPOINTMENTS */}

                <div className="rounded-2xl border border-blue-50 bg-white p-5 shadow-sm sm:p-7">
                  <div className="mb-6">
                    <p className="mb-2 text-sm font-medium text-blue-500">
                      SELECTED DATE
                    </p>

                    <h2 className="text-2xl font-bold text-blue-950">
                      {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(
                        "en-IN",
                        {
                          weekday: "long",
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        }
                      )}
                    </h2>
                  </div>

                  <div className="mb-5 grid grid-cols-2 gap-4">
                    <div className="rounded-xl bg-blue-50 p-4">
                      <p className="text-xs text-blue-500">
                        Total Appointments
                      </p>

                      <h3 className="mt-2 text-2xl font-bold text-blue-950">
                        {loadingDateAppointments
                          ? "..."
                          : dateAppointments.length}
                      </h3>
                    </div>

                    <div className="rounded-xl bg-cyan-50 p-4">
                      <p className="text-xs text-cyan-600">
                        Paid Appointments
                      </p>

                      <h3 className="mt-2 text-2xl font-bold text-cyan-900">
                        {loadingDateAppointments
                          ? "..."
                          : dateAppointments.filter((appointment) =>
                              isPaid(appointment.paymentStatus)
                            ).length}
                      </h3>
                    </div>
                  </div>

                  {calendarError && (
                    <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
                      {calendarError}

                      <button
                        onClick={() =>
                          fetchAppointmentsForDate(selectedDate)
                        }
                        className="mt-3 block font-semibold underline"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {loadingDateAppointments && (
                    <div className="p-8 text-center text-sm text-blue-600">
                      Loading appointments...
                    </div>
                  )}

                  {!loadingDateAppointments &&
                    !calendarError &&
                    dateAppointments.length === 0 && (
                      <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/30 p-8 text-center">
                        <h3 className="font-semibold text-blue-950">
                          No appointments scheduled
                        </h3>

                        <p className="mt-2 text-sm text-gray-400">
                          No appointment records were found for this date.
                        </p>
                      </div>
                    )}

                  {!loadingDateAppointments &&
                    !calendarError &&
                    dateAppointments.length > 0 && (
                      <div className="max-h-[450px] space-y-3 overflow-y-auto">
                        {filteredDateAppointments.map((appointment) => (
                          <div
                            key={appointment.appointmentId}
                            className="rounded-xl border border-blue-50 p-4 hover:bg-blue-50/40"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <h3 className="font-semibold text-blue-950">
                                  {appointment.patientName ||
                                    "Unknown Patient"}
                                </h3>

                                <p className="mt-1 text-xs text-gray-400">
                                  {appointment.patientEmail || "—"}
                                </p>
                              </div>

                              <span className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
                                {formatTime(appointment.appointmentTime)}
                              </span>
                            </div>

                            <div className="mt-4 border-t border-blue-50 pt-3">
                              <p className="text-sm font-medium text-blue-950">
                                {appointment.doctorName || "Unknown Doctor"}
                              </p>

                              <p className="mt-1 text-xs text-gray-400">
                                {appointment.specialization || "—"}
                              </p>

                              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                                  {formatStatus(appointment.status)}
                                </span>

                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                    isPaid(appointment.paymentStatus)
                                      ? "bg-cyan-100 text-cyan-700"
                                      : "bg-red-100 text-red-600"
                                  }`}
                                >
                                  {formatStatus(appointment.paymentStatus)}
                                </span>

                                <span className="text-sm font-bold text-blue-950">
                                  {formatCurrency(appointment.amount)}
                                </span>
                              </div>

                              <p className="mt-3 text-xs text-gray-400">
                                Appointment ID: APT-
                                {appointment.appointmentId}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            </>
          )}

          {/* PATIENT MANAGEMENT */}

          {activeTab === "Patients" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-50 bg-white p-6 shadow-sm">
                <div>
                  <h2 className="text-xl font-bold text-blue-950">
                    Patient Management
                  </h2>

                  <p className="mt-1 text-sm text-gray-400">
                    View, search, and register CuraSync patients.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setShowPatientForm(!showPatientForm);
                    setRegistrationMessage("");
                    setRegistrationError("");
                  }}
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  {showPatientForm
                    ? "Close Registration"
                    : "+ Register New Patient"}
                </button>
              </div>

              {showPatientForm && (
                <div className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
                  <h2 className="mb-2 text-xl font-bold text-blue-950">
                    Register New Patient
                  </h2>

                  <form
                    onSubmit={handleRegisterPatient}
                    className="grid grid-cols-1 gap-5 md:grid-cols-2"
                  >
                    <input
                      type="text"
                      required
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="Patient full name"
                      className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    />

                    <input
                      type="email"
                      required
                      value={patientEmail}
                      onChange={(e) => setPatientEmail(e.target.value)}
                      placeholder="Patient email"
                      className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    />

                    <input
                      type="password"
                      required
                      minLength={6}
                      value={patientPassword}
                      onChange={(e) => setPatientPassword(e.target.value)}
                      placeholder="Create account password"
                      className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    />

                    <button
                      type="submit"
                      disabled={registeringPatient}
                      className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {registeringPatient
                        ? "Registering..."
                        : "Create Patient Account"}
                    </button>
                  </form>

                  {registrationError && (
                    <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-600">
                      {registrationError}
                    </div>
                  )}
                </div>
              )}

              {registrationMessage && (
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm font-medium text-blue-700">
                  ✓ {registrationMessage}
                </div>
              )}

              <div className="rounded-2xl border border-blue-50 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-blue-50 p-6">
                  <div>
                    <h2 className="text-xl font-bold text-blue-950">
                      Registered Patients
                    </h2>

                    <p className="mt-1 text-sm text-gray-400">
                      Real patient records from the database.
                    </p>
                  </div>

                  <input
                    type="text"
                    placeholder="Search name or email..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="w-full rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm outline-none focus:border-blue-500 sm:w-72"
                  />
                </div>

                {patientError && (
                  <div className="m-6 rounded-xl bg-red-50 p-4 text-sm text-red-600">
                    {patientError}

                    <button
                      onClick={() => fetchPatients(patientSearch)}
                      className="ml-3 font-semibold underline"
                    >
                      Retry
                    </button>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left">
                    <thead className="bg-blue-50/60">
                      <tr className="text-xs uppercase tracking-wider text-gray-400">
                        <th className="px-6 py-4">Patient</th>
                        <th className="px-6 py-4">Email</th>
                        <th className="px-6 py-4">Patient ID</th>
                        <th className="px-6 py-4">Registration Date</th>
                      </tr>
                    </thead>

                    <tbody>
                      {patients.map((patient) => (
                        <tr
                          key={patient.id}
                          className="border-t border-blue-50 hover:bg-blue-50/40"
                        >
                          <td className="px-6 py-5">
                            <p className="text-sm font-semibold text-blue-950">
                              {patient.fullName || "Unknown Patient"}
                            </p>
                          </td>

                          <td className="px-6 py-5 text-sm text-gray-500">
                            {patient.email}
                          </td>

                          <td className="px-6 py-5">
                            <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                              PAT-{patient.id}
                            </span>
                          </td>

                          <td className="px-6 py-5 text-sm text-gray-500">
                            {patient.createdAt
                              ? new Date(
                                  patient.createdAt
                                ).toLocaleDateString("en-IN")
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {loadingPatients && (
                  <div className="p-10 text-center text-sm text-blue-600">
                    Loading patient records...
                  </div>
                )}

                {!loadingPatients &&
                  patients.length === 0 &&
                  !patientError && (
                    <div className="p-10 text-center text-sm text-gray-400">
                      No patients found.
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* DOCTORS MANAGEMENT - REAL BACKEND */}

          {activeTab === "Doctors" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-50 bg-white p-6 shadow-sm">
                <div>
                  <h2 className="text-xl font-bold text-blue-950">
                    Doctors Management
                  </h2>

                  <p className="mt-1 text-sm text-gray-400">
                    View registered doctors and their professional details.
                  </p>
                </div>

                <button
                  onClick={fetchDoctors}
                  disabled={loadingDoctors}
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {loadingDoctors ? "Refreshing..." : "↻ Refresh Doctors"}
                </button>
              </div>

              {/* DOCTOR STATISTICS */}

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div className="rounded-2xl border border-blue-50 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-xl text-blue-700">
                    ♧
                  </div>

                  <p className="text-sm text-gray-500">
                    Total Registered Doctors
                  </p>

                  <h2 className="mt-3 text-3xl font-bold text-blue-950">
                    {loadingDoctors ? "..." : doctors.length}
                  </h2>
                </div>

                <div className="rounded-2xl border border-blue-50 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-100 text-xl text-cyan-700">
                    ✚
                  </div>

                  <p className="text-sm text-gray-500">
                    Medical Specializations
                  </p>

                  <h2 className="mt-3 text-3xl font-bold text-blue-950">
                    {loadingDoctors
                      ? "..."
                      : new Set(
                          doctors.map((doctor) => doctor.specialization)
                        ).size}
                  </h2>
                </div>

                <div className="rounded-2xl border border-blue-50 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-xl text-indigo-700">
                    ₹
                  </div>

                  <p className="text-sm text-gray-500">
                    Average Consultation Fee
                  </p>

                  <h2 className="mt-3 text-3xl font-bold text-blue-950">
                    {loadingDoctors || doctors.length === 0
                      ? "..."
                      : formatCurrency(
                          doctors.reduce(
                            (total, doctor) =>
                              total + Number(doctor.consultationFee || 0),
                            0
                          ) / doctors.length
                        )}
                  </h2>
                </div>
              </div>

              {/* DOCTOR SEARCH */}

              <div className="overflow-hidden rounded-2xl border border-blue-50 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-blue-50 p-6">
                  <div>
                    <h2 className="text-xl font-bold text-blue-950">
                      Registered Doctors
                    </h2>

                    <p className="mt-1 text-sm text-gray-400">
                      Doctors retrieved directly from the CuraSync Java backend.
                    </p>
                  </div>

                  <input
                    type="text"
                    placeholder="Search doctor or specialization..."
                    value={doctorSearch}
                    onChange={(e) => setDoctorSearch(e.target.value)}
                    className="w-full rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 sm:w-80"
                  />
                </div>

                {/* DOCTOR ERROR */}

                {doctorError && (
                  <div className="m-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
                    <p>{doctorError}</p>

                    <button
                      onClick={fetchDoctors}
                      className="mt-3 font-semibold underline"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {/* DOCTOR TABLE */}

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left">
                    <thead className="bg-blue-50/60">
                      <tr className="text-xs uppercase tracking-wider text-gray-400">
                        <th className="px-6 py-4">Doctor</th>
                        <th className="px-6 py-4">Specialization</th>
                        <th className="px-6 py-4">Qualification</th>
                        <th className="px-6 py-4">Experience</th>
                        <th className="px-6 py-4">Consultation Fee</th>
                        <th className="px-6 py-4">Doctor ID</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredDoctors.map((doctor) => (
                        <tr
                          key={doctor.id}
                          className="border-t border-blue-50 transition hover:bg-blue-50/40"
                        >
                          {/* DOCTOR NAME */}

                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 font-bold text-blue-700">
                                {doctor.fullName
                                  ?.charAt(0)
                                  .toUpperCase() || "D"}
                              </div>

                              <div>
                                <p className="text-sm font-semibold text-blue-950">
                                  {doctor.fullName || "Unknown Doctor"}
                                </p>

                                <p className="mt-1 text-xs text-gray-400">
                                  {doctor.email || "—"}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* SPECIALIZATION */}

                          <td className="px-6 py-5">
                            <span className="rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700">
                              {doctor.specialization || "Not specified"}
                            </span>
                          </td>

                          {/* QUALIFICATION */}

                          <td className="px-6 py-5 text-sm font-medium text-blue-950">
                            {doctor.qualification || "—"}
                          </td>

                          {/* EXPERIENCE */}

                          <td className="px-6 py-5">
                            <span className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
                              {doctor.experienceYears ?? 0} years
                            </span>
                          </td>

                          {/* CONSULTATION FEE */}

                          <td className="px-6 py-5 text-sm font-bold text-blue-950">
                            {formatCurrency(doctor.consultationFee)}
                          </td>

                          {/* ID */}

                          <td className="px-6 py-5">
                            <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                              DOC-{doctor.id}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* LOADING */}

                {loadingDoctors && (
                  <div className="p-10 text-center">
                    <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />

                    <p className="text-sm font-medium text-blue-600">
                      Loading real doctor records...
                    </p>
                  </div>
                )}

                {/* EMPTY STATE */}

                {!loadingDoctors &&
                  !doctorError &&
                  filteredDoctors.length === 0 && (
                    <div className="p-10 text-center">
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-2xl text-blue-700">
                        ♧
                      </div>

                      <h3 className="font-semibold text-blue-950">
                        No doctors found
                      </h3>

                      <p className="mt-2 text-sm text-gray-400">
                        No doctors match your search.
                      </p>
                    </div>
                  )}

                {/* TABLE FOOTER */}

                {!loadingDoctors && filteredDoctors.length > 0 && (
                  <div className="border-t border-blue-50 px-6 py-4 text-xs text-gray-400">
                    Showing {filteredDoctors.length} of {doctors.length} real
                    doctor record(s).
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CONSULTATION FEES MANAGEMENT */}
          {activeTab === "Consultation Fees" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-blue-50 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-blue-950">
                      Consultation Fee Management
                    </h2>
                    <p className="mt-1 text-sm text-gray-400">
                      Configure department-wise standard fees and individual doctor overrides.
                    </p>
                  </div>
                  <button
                    onClick={fetchFeeSettings}
                    disabled={loadingFees}
                    className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {loadingFees ? "Refreshing..." : "↻ Refresh Fees"}
                  </button>
                </div>
              </div>

              {feeError && (
                <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
                  {feeError}
                </div>
              )}
              {feeMessage && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
                  ✓ {feeMessage}
                </div>
              )}

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                {/* DEPARTMENT-WISE FEE */}
                <div className="rounded-2xl border border-blue-50 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-xl text-blue-700">
                      🏥
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-blue-950">Department Fee</h3>
                      <p className="text-xs text-gray-400">Default fee for doctors in a department</p>
                    </div>
                  </div>

                  <form onSubmit={handleSaveDepartmentFee} className="space-y-4">
                    <select
                      required
                      value={departmentNameInput}
                      onChange={(e) => setDepartmentNameInput(e.target.value)}
                      className="w-full rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    >
                      <option value="" disabled>Choose a department</option>
                      {departmentOptions.map((department) => (
                        <option key={department} value={department}>
                          {department}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      required
                      min="1"
                      step="1"
                      value={departmentFeeInput}
                      onChange={(e) => setDepartmentFeeInput(e.target.value)}
                      placeholder="Consultation fee in ₹"
                      className="w-full rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={savingDepartmentFee}
                      className="w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {savingDepartmentFee ? "Saving..." : "Save Department Fee"}
                    </button>
                  </form>

                  <div className="mt-6 border-t border-blue-50 pt-5">
                    <h4 className="mb-3 text-sm font-bold text-blue-950">Configured Departments</h4>
                    {loadingFees ? (
                      <p className="text-sm text-blue-600">Loading fee settings...</p>
                    ) : departmentFees.length === 0 ? (
                      <p className="rounded-xl bg-blue-50 p-4 text-sm text-gray-500">
                        No department fees configured yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {departmentFees.map((department, index) => (
                          <div
                            key={`${department.departmentName}-${index}`}
                            className="flex items-center justify-between rounded-xl border border-blue-50 bg-blue-50/40 px-4 py-3"
                          >
                            <span className="text-sm font-semibold text-blue-950">
                              {department.departmentName}
                            </span>
                            <span className="text-sm font-bold text-blue-700">
                              {formatCurrency(department.fee)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* INDIVIDUAL DOCTOR FEE */}
                <div className="rounded-2xl border border-blue-50 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-xl text-indigo-700">
                      ♧
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-blue-950">Individual Doctor Fee</h3>
                      <p className="text-xs text-gray-400">Override the department fee for one doctor</p>
                    </div>
                  </div>

                  <form onSubmit={handleSaveIndividualDoctorFee} className="space-y-4">
                    <select
                      required
                      value={selectedFeeDoctorId}
                      onChange={(e) => setSelectedFeeDoctorId(e.target.value)}
                      className="w-full rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    >
                      <option value="">Select a doctor</option>
                      {doctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>
                          {doctor.fullName} — {doctor.specialization}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      required
                      min="1"
                      step="1"
                      value={individualDoctorFeeInput}
                      onChange={(e) => setIndividualDoctorFeeInput(e.target.value)}
                      placeholder="Individual consultation fee in ₹"
                      className="w-full rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={savingDoctorFee || doctors.length === 0}
                      className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {savingDoctorFee ? "Saving..." : "Save Individual Fee"}
                    </button>
                  </form>

                  <div className="mt-6 border-t border-blue-50 pt-5">
                    <h4 className="mb-3 text-sm font-bold text-blue-950">Doctor Fee Overview</h4>
                    {loadingDoctors ? (
                      <p className="text-sm text-blue-600">Loading doctor records...</p>
                    ) : doctors.length === 0 ? (
                      <p className="rounded-xl bg-blue-50 p-4 text-sm text-gray-500">No doctors found.</p>
                    ) : (
                      <div className="max-h-[420px] space-y-3 overflow-y-auto">
                        {doctors.map((doctor) => (
                          <div
                            key={doctor.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-50 p-4"
                          >
                            <div>
                              <p className="text-sm font-semibold text-blue-950">
                                {doctor.fullName || "Unknown Doctor"}
                              </p>
                              <p className="mt-1 text-xs text-gray-400">
                                {doctor.specialization || "Department not specified"}
                              </p>
                              <span
                                className={`mt-2 inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                  doctor.feeOverride
                                    ? "bg-indigo-100 text-indigo-700"
                                    : "bg-emerald-100 text-emerald-700"
                                }`}
                              >
                                {doctor.feeOverride ? "Individual override" : "Department/default fee"}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-blue-950">
                                {formatCurrency(doctor.consultationFee)}
                              </span>
                              {doctor.feeOverride && (
                                <button
                                  onClick={() => handleResetDoctorFee(doctor.id)}
                                  disabled={resettingDoctorId === doctor.id}
                                  className="rounded-lg border border-blue-100 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                                >
                                  {resettingDoctorId === doctor.id ? "Resetting..." : "Reset"}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
                <strong>Fee behavior:</strong> A department fee is the standard fee for doctors in that department.
                An individual doctor fee takes priority over the department fee. Resetting an individual override
                returns that doctor to the department/default fee. The backend should preserve the fee already
                attached to an existing appointment when settings are changed.
              </div>
            </div>
          )}

          {/* PAYMENTS PLACEHOLDER */}

          {activeTab === "Payments" && (
            <div className="rounded-2xl border border-blue-50 bg-white p-10 text-center shadow-sm">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-3xl text-blue-700">
                ₹
              </div>

              <h2 className="text-2xl font-bold text-blue-950">
                Payments Management
              </h2>

              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-gray-400">
                The payment collection and transaction management module will
                be connected to the CuraSync Java backend next.
              </p>
            </div>
          )}

          {/* FOOTER */}

          <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
            <p>© 2026 CuraSync Hospital Management System</p>

            <p>Designed for smarter healthcare operations.</p>
          </footer>
        </main>
      </div>
    </div>
  );
}