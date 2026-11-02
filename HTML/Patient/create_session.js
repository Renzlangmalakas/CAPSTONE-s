// Script to create a test session for patient page
sessionStorage.setItem("gm_dental_current_user", JSON.stringify({
    id: 1,
    email: "patient@test.com",
    name: "Test Patient",
    fullName: "Test Patient User",
    role: "patient",
    patientId: "PT-001"
}));

console.log("Session created. Reload patient.html now.");