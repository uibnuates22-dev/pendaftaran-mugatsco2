/* =========================================================
   MUGATSCO 2 - WEBSITE PENDAFTARAN
   Isi 2 nilai di bawah dari Supabase:
   Settings > API > Project URL dan Publishable/anon key
   Jangan gunakan service_role key di website.
   ========================================================= */

const SUPABASE_URL = "https://iekgsctzsmxhxvjnspse.supabase.co";
const SUPABASE_KEY = "sb_publishable_06qj7V3IgQn3jAmURmxwEA_BgvXsNrK";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Periode resmi pendaftaran
const OPEN_DATE = new Date("2026-09-10T00:00:00+07:00");
const CLOSE_DATE = new Date("2026-10-22T23:59:59+07:00");

// Default anggota Minisoccer. Sesuaikan jika juknis resmi berbeda.
const MIN_TEAM_MEMBERS = 5;
const MAX_TEAM_MEMBERS = 12;

const form = document.getElementById("registrationForm");
const competition = document.getElementById("competition");
const individualFields = document.getElementById("individualFields");
const teamFields = document.getElementById("teamFields");
const membersList = document.getElementById("membersList");
const addMemberBtn = document.getElementById("addMemberBtn");
const submitBtn = document.getElementById("submitBtn");
const submitText = document.getElementById("submitText");
const spinner = document.getElementById("spinner");
const statusBanner = document.getElementById("statusBanner");
const successBox = document.getElementById("successBox");
const successMessage = document.getElementById("successMessage");
const newRegistrationBtn = document.getElementById("newRegistrationBtn");

let competitions = [];
let isSubmitting = false;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  renderPeriodStatus();
  await loadCompetitions();
  showCompetitionFields();
}

function renderPeriodStatus() {
  const now = new Date();
  const open = now >= OPEN_DATE && now <= CLOSE_DATE;

  statusBanner.className = "status-banner show " + (open ? "open" : "closed");
  statusBanner.textContent = open
    ? "Pendaftaran diperpanjang sampai 22 Oktober 2026."
    : "Pendaftaran saat ini ditutup. Periode pendaftaran: 10 September–22 Oktober 2026.";

  submitBtn.disabled = !open;
}

async function loadCompetitions() {
  competition.innerHTML = '<option value="">Memuat cabang lomba...</option>';

  const { data, error } = await supabaseClient
    .from("cabang_lomba")
    .select("id, nama_cabang, tipe")
    .eq("aktif", true)
    .order("id", { ascending: true });

  if (error) {
    console.error(error);
    competition.innerHTML =
      '<option value="">Gagal memuat cabang lomba</option>';
    showError(
      "Cabang lomba gagal dimuat. Periksa URL dan Publishable/anon key Supabase.",
    );
    return;
  }

  competitions = data || [];
  competition.innerHTML = '<option value="">-- Pilih cabang lomba --</option>';

  competitions.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = `${item.nama_cabang} (${item.tipe === "tim" ? "Tim" : "Individu"})`;
    option.dataset.type = item.tipe;
    competition.appendChild(option);
  });
}

function showCompetitionFields() {
  const selected = competitions.find(
    (x) => String(x.id) === String(competition.value),
  );
  const isTeam = selected && selected.tipe === "tim";

  individualFields.classList.toggle("hidden", !selected || isTeam);
  teamFields.classList.toggle("hidden", !selected || !isTeam);

  if (isTeam && membersList.children.length === 0) {
    for (let i = 0; i < MIN_TEAM_MEMBERS; i++) addMemberRow();
  }
}

competition.addEventListener("change", showCompetitionFields);
addMemberBtn.addEventListener("click", () => addMemberRow());
newRegistrationBtn.addEventListener("click", resetForm);
form.addEventListener("submit", handleSubmit);

function addMemberRow(name = "") {
  if (membersList.children.length >= MAX_TEAM_MEMBERS) {
    showError(`Maksimal ${MAX_TEAM_MEMBERS} anggota tim.`);
    return;
  }

  const row = document.createElement("div");
  row.className = "member-row";

  const number = document.createElement("div");
  number.className = "member-number";

  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 100;
  input.placeholder = "Nama anggota tim";
  input.value = name;

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "remove-member";
  remove.textContent = "×";
  remove.title = "Hapus anggota";
  remove.addEventListener("click", () => {
    row.remove();
    renumberMembers();
  });

  row.append(number, input, remove);
  membersList.appendChild(row);
  renumberMembers();
}

function renumberMembers() {
  [...membersList.children].forEach((row, index) => {
    row.querySelector(".member-number").textContent = index + 1;
  });
}

async function handleSubmit(event) {
  event.preventDefault();
  if (isSubmitting) return;

  if (!isRegistrationOpen()) {
    showError("Pendaftaran hanya dibuka 10 September sampai 22 Oktober 2026.");
    renderPeriodStatus();
    return;
  }

  const selected = competitions.find(
    (x) => String(x.id) === String(competition.value),
  );
  if (!selected) {
    showError("Silakan pilih cabang lomba.");
    return;
  }

  clearErrors();
  setLoading(true);

  try {
    if (selected.tipe === "tim") {
      await submitTeam(selected);
    } else {
      await submitIndividual(selected);
    }
  } catch (error) {
    console.error(error);
    showError(formatDatabaseError(error));
  } finally {
    setLoading(false);
  }
}

async function submitIndividual(selected) {
  const name = valueOf("participantName");
  const school = valueOf("school");
  const phone = valueOf("phone");

  if (!name || !school || !phone) {
    throw new Error("Nama peserta, asal sekolah, dan no. HP wajib diisi.");
  }

  const { data, error } = await supabaseClient.rpc("daftar_peserta_individu", {
    p_nama_peserta: name,
    p_asal_sekolah: school,
    p_no_hp: phone,
    p_cabang_id: selected.id,
  });

  if (error) throw error;

  const nomorPendaftaran = data?.[0]?.nomor_pendaftaran;

  if (!nomorPendaftaran) {
    throw new Error("Nomor pendaftaran tidak berhasil dibuat.");
  }

  if (error) throw error;

  showSuccess(
    `Pendaftaran ${escapeHtml(selected.nama_cabang)} berhasil. ` +
      `Nomor pendaftaran kamu adalah <strong>${escapeHtml(nomorPendaftaran)}</strong>.`,
  );
}

async function submitTeam(selected) {
  const teamName = valueOf("teamName");
  const school = valueOf("teamSchool");
  const phone = valueOf("teamPhone");

  const memberNames = [...membersList.querySelectorAll("input")]
    .map((input) => input.value.trim())
    .filter(Boolean);

  if (!teamName || !school || !phone) {
    throw new Error("Nama tim, asal sekolah, dan no. HP wajib diisi.");
  }

  if (memberNames.length < MIN_TEAM_MEMBERS) {
    throw new Error(
      `Minisoccer membutuhkan minimal ${MIN_TEAM_MEMBERS} anggota pada form ini.`,
    );
  }

  if (memberNames.length > MAX_TEAM_MEMBERS) {
    throw new Error(`Maksimal ${MAX_TEAM_MEMBERS} anggota.`);
  }

  // RPC melakukan INSERT tim + anggota secara atomik.
  const { data, error } = await supabaseClient.rpc("daftar_tim_minisoccer", {
    p_nama_tim: teamName,
    p_asal_sekolah: school,
    p_no_hp: phone,
    p_anggota: memberNames,
  });

  if (error) throw error;

  const result = Array.isArray(data) ? data[0] : data;
  const nomor = result?.nomor_pendaftaran || result?.["nomor_pendaftaran"];

  showSuccess(
    `Pendaftaran tim <strong>${escapeHtml(teamName)}</strong> pada ` +
      `${escapeHtml(selected.nama_cabang)} berhasil. ` +
      `Nomor pendaftaran tim: <strong>${escapeHtml(nomor || "tersimpan")}</strong>.`,
  );
}

function isRegistrationOpen() {
  const now = new Date();
  return now >= OPEN_DATE && now <= CLOSE_DATE;
}

function valueOf(id) {
  return document.getElementById(id).value.trim();
}

function setLoading(loading) {
  isSubmitting = loading;
  submitBtn.disabled = loading || !isRegistrationOpen();
  submitText.classList.toggle("hidden", loading);
  spinner.classList.toggle("hidden", !loading);
}

function showSuccess(message) {
  form.classList.add("hidden");
  successBox.classList.remove("hidden");
  successMessage.innerHTML = message;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  form.reset();
  membersList.innerHTML = "";
  successBox.classList.add("hidden");
  form.classList.remove("hidden");
  showCompetitionFields();
  renderPeriodStatus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showError(message) {
  statusBanner.className = "status-banner show closed";
  statusBanner.textContent = message;
}

function clearErrors() {
  renderPeriodStatus();
}

function formatDatabaseError(error) {
  const message = String(error?.message || error || "");

  if (error?.code === "23505") {
    return "Peserta tersebut sudah terdaftar pada cabang lomba yang sama. Satu peserta tidak boleh mendaftar dua kali pada cabang yang sama.";
  }

  if (message.includes("Pendaftaran MUGATSCO 2 dibuka")) {
    return "Pendaftaran sedang di luar periode. Pendaftaran dibuka 10 September sampai 22 Oktober 2026.";
  }

  if (message.includes("Failed to fetch")) {
    return "Tidak dapat terhubung ke Supabase. Periksa koneksi internet dan konfigurasi Supabase.";
  }

  return message || "Pendaftaran gagal. Silakan coba lagi.";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
