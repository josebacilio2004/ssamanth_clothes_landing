// Global State
let currentParticipants = [];
let unsubscribeRealtime = null;

// Hashing function for simple client-side credential check
// (Better than plaintext, though client-side is inherently visible in JS, 
// we also configure Firestore rules to restrict reads to authenticated or simple checks)
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
}

// Credentials hashes (username: ssamira, password: 60621566ssam)
const ADMIN_USER_HASH = simpleHash("ssamira");
const ADMIN_PASS_HASH = simpleHash("60621566ssam");

document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

// Initialize Application
function initApp() {
    setupRouting();
    setupForms();
    setupButtons();
    checkExistingRegistration();
}

// Simple SPA Routing based on hash
function setupRouting() {
    const handleRoute = () => {
        const hash = window.location.hash;
        
        // Hide all views
        document.getElementById("public-view").classList.add("hidden");
        document.getElementById("admin-dashboard").classList.add("hidden");
        document.getElementById("admin-login-modal").classList.add("hidden");
        
        if (hash === "#admin") {
            if (isAdminAuthenticated()) {
                showAdminDashboard();
            } else {
                // Show public view, but open login modal
                document.getElementById("public-view").classList.remove("hidden");
                document.getElementById("admin-login-modal").classList.remove("hidden");
            }
        } else {
            // Default to public view
            document.getElementById("public-view").classList.remove("hidden");
            // Stop listening to admin snapshot if we were on admin
            if (unsubscribeRealtime) {
                unsubscribeRealtime();
                unsubscribeRealtime = null;
            }
        }
    };

    window.addEventListener("hashchange", handleRoute);
    handleRoute(); // Run once on load
}

// Check if admin is authenticated
function isAdminAuthenticated() {
    return sessionStorage.getItem("admin_logged") === "true";
}

// Setup Form Handlers
function setupForms() {
    // Raffle Registration Form
    const raffleForm = document.getElementById("raffle-form");
    raffleForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const nameInput = document.getElementById("user-name");
        const phoneInput = document.getElementById("user-phone");
        const submitBtn = document.getElementById("btn-submit-raffle");
        
        const name = nameInput.value.trim();
        const phone = phoneInput.value.trim();
        
        // Basic validations
        if (!name || !phone) return;
        
        // Disable button & show loading state
        submitBtn.disabled = true;
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.innerHTML = `<span>Registrando...</span> <i class="fa-solid fa-spinner fa-spin"></i>`;
        
        try {
            // Save to Firebase Firestore
            await db.collection("sorteo_participantes").add({
                nombre: name,
                telefono: phone,
                fecha_registro: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Save local storage state
            localStorage.setItem("ssamanth_registered", "true");
            localStorage.setItem("ssamanth_user_name", name);
            localStorage.setItem("ssamanth_user_phone", phone);
            
            // Transition UI
            showRegistrationSuccess(name, phone);
            
        } catch (error) {
            console.error("Error al registrar participante: ", error);
            alert("Hubo un error al registrar tus datos. Por favor, intenta de nuevo.");
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    });

    // Admin Login Form
    const adminForm = document.getElementById("admin-login-form");
    adminForm.addEventListener("submit", (e) => {
        e.preventDefault();
        
        const userInput = document.getElementById("admin-user").value.trim();
        const passInput = document.getElementById("admin-pass").value;
        const loginError = document.getElementById("login-error");
        
        if (simpleHash(userInput) === ADMIN_USER_HASH && simpleHash(passInput) === ADMIN_PASS_HASH) {
            // Successful Login
            sessionStorage.setItem("admin_logged", "true");
            loginError.classList.add("hidden");
            document.getElementById("admin-login-modal").classList.add("hidden");
            adminForm.reset();
            window.location.hash = "#admin";
            showAdminDashboard();
        } else {
            // Failed Login
            loginError.classList.remove("hidden");
        }
    });
}

// Setup buttons and modals click handlers
function setupButtons() {
    // Open admin login modal
    document.getElementById("btn-open-login").addEventListener("click", () => {
        if (isAdminAuthenticated()) {
            window.location.hash = "#admin";
        } else {
            document.getElementById("admin-login-modal").classList.remove("hidden");
        }
    });

    // Close admin login modal
    document.getElementById("btn-close-login").addEventListener("click", () => {
        document.getElementById("admin-login-modal").classList.add("hidden");
        // Remove hash without reload
        if (window.location.hash === "#admin") {
            history.pushState("", document.title, window.location.pathname + window.location.search);
            // Manually trigger route handler
            document.getElementById("public-view").classList.remove("hidden");
        }
    });

    // Copy Link Button
    const copyBtn = document.getElementById("btn-copy-link");
    copyBtn.addEventListener("click", () => {
        const shareInput = document.getElementById("share-link-input");
        shareInput.select();
        shareInput.setSelectionRange(0, 99999); /* For mobile devices */
        
        navigator.clipboard.writeText(shareInput.value)
            .then(() => {
                copyBtn.innerHTML = `<i class="fa-solid fa-check"></i> ¡Copiado!`;
                copyBtn.classList.add("copied");
                setTimeout(() => {
                    copyBtn.innerHTML = `<i class="fa-regular fa-copy"></i> Compartir`;
                    copyBtn.classList.remove("copied");
                }, 2000);
            })
            .catch(err => {
                console.error("Error al copiar enlace: ", err);
            });
    });

    // Logout Button
    document.getElementById("btn-logout").addEventListener("click", () => {
        sessionStorage.removeItem("admin_logged");
        window.location.hash = "";
    });

    // Reset Sorteo Modal triggers
    const resetModal = document.getElementById("reset-confirm-modal");
    document.getElementById("btn-reset-raffle").addEventListener("click", () => {
        resetModal.classList.remove("hidden");
    });

    document.getElementById("btn-cancel-reset").addEventListener("click", () => {
        resetModal.classList.add("hidden");
    });

    document.getElementById("btn-confirm-reset").addEventListener("click", async () => {
        resetModal.classList.add("hidden");
        await resetRaffleData();
    });

    // Live Search Filter for Admin Table
    document.getElementById("search-input").addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        filterAndRenderTable(query);
    });

    // Export Excel/CSV Button
    document.getElementById("btn-export-excel").addEventListener("click", () => {
        exportParticipantsToCSV();
    });
}

// Check if user is already registered in this browser session
function checkExistingRegistration() {
    const isRegistered = localStorage.getItem("ssamanth_registered");
    if (isRegistered === "true") {
        const name = localStorage.getItem("ssamanth_user_name");
        const phone = localStorage.getItem("ssamanth_user_phone");
        showRegistrationSuccess(name, phone);
    }
}

// UI updates on registration success
function showRegistrationSuccess(name, phone) {
    // Hide form, show success message
    document.getElementById("raffle-form").classList.add("hidden");
    document.getElementById("form-success").classList.remove("hidden");
    
    // Highlight step 1 as complete
    document.getElementById("step-1-card").classList.add("completed-step");
    
    // Enable Step 2 WhatsApp Card
    const step2Card = document.getElementById("step-2-card");
    step2Card.classList.remove("disabled");
    
    // Configure WhatsApp Button
    const waBtn = document.getElementById("btn-whatsapp");
    waBtn.classList.remove("disabled-btn");
    
    const formattedName = encodeURIComponent(name);
    const customMessage = `Hola Ssamanth Clothes! Mi nombre es ${formattedName} (Cel: ${phone}) y aquí tienes las capturas de pantalla para validar mi participación en el Gran Sorteo.`;
    waBtn.href = `https://wa.me/51917218376?text=${customMessage}`;
}

// Show Admin Dashboard and subscribe to real-time updates
function showAdminDashboard() {
    document.getElementById("admin-dashboard").classList.remove("hidden");
    
    const tbody = document.getElementById("participants-tbody");
    tbody.innerHTML = `<tr><td colspan="5" class="loading-td"><i class="fa-solid fa-spinner fa-spin"></i> Cargando participantes...</td></tr>`;
    
    // Listen to real-time changes
    unsubscribeRealtime = db.collection("sorteo_participantes")
        .orderBy("fecha_registro", "desc")
        .onSnapshot((snapshot) => {
            currentParticipants = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                currentParticipants.push({
                    id: doc.id,
                    nombre: data.nombre || "Sin nombre",
                    telefono: data.telefono || "Sin teléfono",
                    fecha: data.fecha_registro ? data.fecha_registro.toDate() : new Date()
                });
            });
            
            // Update stats
            updateAdminStats();
            
            // Render table
            const searchQuery = document.getElementById("search-input").value.toLowerCase().trim();
            filterAndRenderTable(searchQuery);
            
        }, (error) => {
            console.error("Error al escuchar participantes: ", error);
            tbody.innerHTML = `<tr><td colspan="5" class="loading-td" style="color: #e74c3c;"><i class="fa-solid fa-triangle-exclamation"></i> Error al cargar datos. Verifica las reglas de seguridad de Firestore.</td></tr>`;
        });
}

// Update Dashboard Statistics Cards
function updateAdminStats() {
    document.getElementById("stat-total-participants").innerText = currentParticipants.length;
    
    if (currentParticipants.length > 0) {
        const latestDate = currentParticipants[0].fecha;
        const options = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
        document.getElementById("stat-latest-date").innerText = latestDate.toLocaleDateString('es-PE', options);
    } else {
        document.getElementById("stat-latest-date").innerText = "-";
    }
}

// Filter and render table based on query
function filterAndRenderTable(query) {
    const tbody = document.getElementById("participants-tbody");
    tbody.innerHTML = "";
    
    const filtered = currentParticipants.filter(p => 
        p.nombre.toLowerCase().includes(query) || 
        p.telefono.includes(query)
    );
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="loading-td">No se encontraron participantes.</td></tr>`;
        return;
    }
    
    filtered.forEach((p, idx) => {
        const row = document.createElement("tr");
        
        const dateFormatted = p.fecha.toLocaleDateString('es-PE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        // WhatsApp link for admin
        const waLink = `https://wa.me/${p.telefono.startsWith('51') ? p.telefono : '51' + p.telefono}`;
        
        row.innerHTML = `
            <td>${idx + 1}</td>
            <td><strong>${p.nombre}</strong></td>
            <td>${p.telefono}</td>
            <td>${dateFormatted}</td>
            <td class="action-btn-cell">
                <a href="${waLink}" target="_blank" class="row-action-btn whatsapp-row-btn" title="Contactar por WhatsApp">
                    <i class="fa-brands fa-whatsapp"></i>
                </a>
                <button class="row-action-btn delete-row-btn" onclick="deleteParticipant('${p.id}')" title="Eliminar participante">
                    <i class="fa-regular fa-trash-can"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Delete single participant (exposed globally for inline onclick)
window.deleteParticipant = async function(id) {
    if (confirm("¿Estás seguro de que deseas eliminar este participante?")) {
        try {
            await db.collection("sorteo_participantes").doc(id).delete();
        } catch (error) {
            console.error("Error al eliminar: ", error);
            alert("No se pudo eliminar el registro.");
        }
    }
};

// Reset Raffle Data (Bulk Delete)
async function resetRaffleData() {
    try {
        const snapshot = await db.collection("sorteo_participantes").get();
        if (snapshot.empty) {
            alert("No hay participantes para eliminar.");
            return;
        }
        
        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        
        // Also clear local state of the browser just in case, allowing the admin to test registration again
        localStorage.removeItem("ssamanth_registered");
        localStorage.removeItem("ssamanth_user_name");
        localStorage.removeItem("ssamanth_user_phone");
        
        alert("Sorteo reiniciado exitosamente. Todos los registros anteriores fueron eliminados.");
        
    } catch (error) {
        console.error("Error al reiniciar sorteo: ", error);
        alert("Hubo un error al intentar reiniciar el sorteo.");
    }
}

// Export participants to CSV
function exportParticipantsToCSV() {
    if (currentParticipants.length === 0) {
        alert("No hay registros para exportar.");
        return;
    }
    
    // CSV Header (including UTF-8 BOM to display accented characters correctly in Excel)
    let csvContent = "\uFEFF";
    csvContent += "N°,Nombre Completo,Celular / WhatsApp,Fecha de Registro\n";
    
    currentParticipants.forEach((p, idx) => {
        const dateFormatted = p.fecha.toLocaleString('es-PE');
        // Escape commas and quotes for CSV safety
        const nameEscaped = `"${p.nombre.replace(/"/g, '""')}"`;
        const phoneEscaped = `"${p.telefono.replace(/"/g, '""')}"`;
        
        csvContent += `${idx + 1},${nameEscaped},${phoneEscaped},"${dateFormatted}"\n`;
    });
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    link.setAttribute("href", url);
    link.setAttribute("download", `participantes_sorteo_ssamanth_clothes_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
