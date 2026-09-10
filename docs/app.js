// Global State
let currentParticipants = [];
let unsubscribeRealtime = null;

// Credentials direct comparison for client-side static page
const ADMIN_USER = "ssamira";
const ADMIN_PASS = "60621566ssam";

document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

// Initialize Application
function initApp() {
    setupRouting();
    setupForms();
    setupButtons();
    checkExistingRegistration();
    setupVoting();
    setupImageLightbox();
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
    // Dinámica 5: Ticket Tier selection toggle
    const tierRadios = document.querySelectorAll('input[name="ticket-tier"]');
    tierRadios.forEach(radio => {
        radio.addEventListener("change", (e) => {
            document.querySelectorAll(".ticket-tier-card").forEach(card => card.classList.remove("active"));
            const parentCard = e.target.closest(".ticket-tier-card");
            if (parentCard) parentCard.classList.add("active");
        });
    });

    // Raffle Registration Form
    const raffleForm = document.getElementById("raffle-form");
    raffleForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const nameInput = document.getElementById("user-name");
        const phoneInput = document.getElementById("user-phone");
        const submitBtn = document.getElementById("btn-submit-raffle");
        
        const name = nameInput.value.trim();
        const phone = phoneInput.value.trim();
        
        // Dinámica 5: Ticket tier
        const selectedTierRadio = document.querySelector('input[name="ticket-tier"]:checked');
        const tickets = selectedTierRadio ? parseInt(selectedTierRadio.value, 10) : 1;
        
        // Basic validations
        if (!name || !phone) return;
        
        // Disable button & show loading state
        submitBtn.disabled = true;
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.innerHTML = `<span>Registrando...</span> <i class="fa-solid fa-spinner fa-spin"></i>`;
        
        try {
            // Save to Firebase Firestore with tickets multiplier
            await db.collection("sorteo_participantes").add({
                nombre: name,
                telefono: phone,
                tickets: tickets,
                fecha_registro: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Save local storage state
            localStorage.setItem("ssamanth_registered", "true");
            localStorage.setItem("ssamanth_user_name", name);
            localStorage.setItem("ssamanth_user_phone", phone);
            localStorage.setItem("ssamanth_user_tickets", tickets.toString());
            
            // Transition UI
            showRegistrationSuccess(name, phone, tickets);
            
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
        
        if (userInput === ADMIN_USER && passInput === ADMIN_PASS) {
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
        const tickets = parseInt(localStorage.getItem("ssamanth_user_tickets") || "1", 10);
        showRegistrationSuccess(name, phone, tickets);
    }
}

// UI updates on registration success
function showRegistrationSuccess(name, phone, tickets = 1) {
    if (!tickets) {
        tickets = parseInt(localStorage.getItem("ssamanth_user_tickets") || "1", 10);
    }

    // Hide form, show success message
    document.getElementById("raffle-form").classList.add("hidden");
    const formSuccess = document.getElementById("form-success");
    formSuccess.classList.remove("hidden");
    
    // Update ticket summary text
    const summaryText = document.getElementById("success-ticket-summary");
    if (summaryText) {
        summaryText.innerHTML = `Tus datos han sido registrados con <strong>${tickets} Ticket(s)</strong>. Continúa al paso 2 para enviar tus capturas y activar tu cupón.`;
    }
    
    // Highlight step 1 as complete
    document.getElementById("step-1-card").classList.add("completed-step");
    
    // Enable Step 2 WhatsApp Card
    const step2Card = document.getElementById("step-2-card");
    step2Card.classList.remove("disabled");
    
    // Update instructions if multiple tickets
    const instructionsText = document.getElementById("whatsapp-instructions-text");
    if (instructionsText) {
        instructionsText.innerHTML = `Envía al WhatsApp tus capturas de seguimiento${tickets > 1 ? ` y la <strong>captura de tu historia (${tickets}x tickets seleccionados)</strong>` : ''} para validar tu participación y activar tu código promocional.`;
    }

    // Configure WhatsApp Button with Dinámica 2 (cupón SSAMANTH10) y Dinámica 5 (evidencia tickets)
    const waBtn = document.getElementById("btn-whatsapp");
    waBtn.classList.remove("disabled-btn");
    
    const storyEvidence = tickets > 1 ? ` + captura de mi historia (${tickets}x tickets)` : '';
    const customMessage = `*¡Hola Ssamanth Clothes!* ✨🌸

Mi nombre es *${name}* (Cel: *${phone}*).

🎟️ *¡Ya me registré en el Gran Sorteo con ${tickets} Ticket(s)!*
📸 Adjunto mis capturas de evidencia (seguir cuentas TikTok/IG${storyEvidence}).

🎁 *CÓDIGO DE DESCUENTO:* *SSAMANTH10* (10% OFF)
¡Deseo validarlo para mi próxima compra en Ssamanth Clothes! 👗💖`;

    waBtn.href = `https://api.whatsapp.com/send?phone=51917218376&text=${encodeURIComponent(customMessage)}`;
}

// Show Admin Dashboard and subscribe to real-time updates
function showAdminDashboard() {
    document.getElementById("admin-dashboard").classList.remove("hidden");
    
    const tbody = document.getElementById("participants-tbody");
    tbody.innerHTML = `<tr><td colspan="6" class="loading-td"><i class="fa-solid fa-spinner fa-spin"></i> Cargando participantes...</td></tr>`;
    
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
                    tickets: data.tickets || 1,
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
            tbody.innerHTML = `<tr><td colspan="6" class="loading-td" style="color: #e74c3c;"><i class="fa-solid fa-triangle-exclamation"></i> Error al cargar datos. Verifica las reglas de seguridad de Firestore.</td></tr>`;
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
        tbody.innerHTML = `<tr><td colspan="6" class="loading-td">No se encontraron participantes.</td></tr>`;
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
        const tickets = p.tickets || 1;
        const ticketBadge = `<span class="ticket-pill tier-${tickets}">${tickets}x Ticket${tickets > 1 ? 's' : ''}</span>`;
        
        row.innerHTML = `
            <td>${idx + 1}</td>
            <td><strong>${p.nombre}</strong></td>
            <td>${p.telefono}</td>
            <td>${ticketBadge}</td>
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
        // Delete participants
        const participantsSnapshot = await db.collection("sorteo_participantes").get();
        const batch = db.batch();
        
        participantsSnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        
        // Delete votes
        const votesSnapshot = await db.collection("sorteo_votos").get();
        votesSnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        
        // Clear local storage states
        localStorage.removeItem("ssamanth_registered");
        localStorage.removeItem("ssamanth_user_name");
        localStorage.removeItem("ssamanth_user_phone");
        localStorage.removeItem("ssamanth_user_tickets");
        localStorage.removeItem("ssamanth_voted");
        
        // Reset the UI of voting
        const prizesGrid = document.querySelector(".prizes-grid");
        if (prizesGrid) {
            prizesGrid.classList.remove("has-voted");
        }
        document.querySelectorAll(".option-card").forEach(card => {
            card.classList.remove("voted-choice");
        });
        ["locas", "university"].forEach(opt => {
            const btn = document.getElementById(`btn-vote-${opt}`);
            const resultDiv = document.getElementById(`result-${opt}`);
            if (btn) {
                btn.classList.remove("hidden");
                btn.disabled = false;
            }
            if (resultDiv) {
                resultDiv.classList.add("hidden");
            }
        });
        
        alert("Sorteo y votaciones reiniciados exitosamente. Todos los registros anteriores fueron eliminados.");
        
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
    csvContent += "N°,Nombre Completo,Celular / WhatsApp,Tickets,Fecha de Registro\n";
    
    currentParticipants.forEach((p, idx) => {
        const dateFormatted = p.fecha.toLocaleString('es-PE');
        // Escape commas and quotes for CSV safety
        const nameEscaped = `"${p.nombre.replace(/"/g, '""')}"`;
        const phoneEscaped = `"${p.telefono.replace(/"/g, '""')}"`;
        const tickets = p.tickets || 1;
        
        csvContent += `${idx + 1},${nameEscaped},${phoneEscaped},${tickets},"${dateFormatted}"\n`;
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

// Global variable to store vote counts (Dinámica 1: Jeans Locas vs Jeans University)
let voteCounts = { locas: 0, university: 0 };

// Setup Interactive Voting Questionnaire
function setupVoting() {
    const voteButtons = document.querySelectorAll(".vote-btn");
    
    // Real-time listener for votes
    db.collection("sorteo_votos").onSnapshot((snapshot) => {
        voteCounts = { locas: 0, university: 0 };
        snapshot.forEach(doc => {
            const opt = doc.data().opcion;
            if (voteCounts.hasOwnProperty(opt)) {
                voteCounts[opt]++;
            }
        });
        
        // Update client voting UI results
        updateVotingUI();
        // Update admin panel voting results
        updateAdminVotingUI();
    }, (error) => {
        console.error("Error al obtener votos en tiempo real: ", error);
    });

    // Add click event to buttons
    voteButtons.forEach(btn => {
        btn.addEventListener("click", async () => {
            const option = btn.getAttribute("data-option");
            
            // Prevent multiple votes
            if (localStorage.getItem("ssamanth_voted")) return;
            
            // Disable buttons immediately to prevent spam click
            voteButtons.forEach(b => b.disabled = true);
            
            try {
                // Add vote to Firestore
                await db.collection("sorteo_votos").add({
                    opcion: option,
                    fecha: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Store that this user has voted
                localStorage.setItem("ssamanth_voted", option);
                
                // Update UI
                updateVotingUI();
                
            } catch (error) {
                console.error("Error al registrar voto: ", error);
                alert("Hubo un error al registrar tu voto. Por favor, intenta de nuevo.");
                voteButtons.forEach(b => b.disabled = false);
            }
        });
    });
}

// Update client voting questionnaire results
function updateVotingUI() {
    const votedOption = localStorage.getItem("ssamanth_voted");
    if (!votedOption) return; // Only show results if they have voted
    
    const prizesGrid = document.querySelector(".prizes-grid");
    if (prizesGrid) prizesGrid.classList.add("has-voted");
    
    // Highlight chosen card
    document.querySelectorAll(".option-card").forEach(card => {
        card.classList.remove("voted-choice");
    });
    const chosenCard = document.getElementById(`card-${votedOption}`);
    if (chosenCard) {
        chosenCard.classList.add("voted-choice");
    }
    
    const totalVotes = voteCounts.locas + voteCounts.university;
    
    ["locas", "university"].forEach(opt => {
        const btn = document.getElementById(`btn-vote-${opt}`);
        const resultDiv = document.getElementById(`result-${opt}`);
        
        if (btn) btn.classList.add("hidden");
        if (resultDiv) {
            resultDiv.classList.remove("hidden");
            
            const count = voteCounts[opt];
            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            
            resultDiv.querySelector(".vote-percentage").innerText = `${pct}%`;
            resultDiv.querySelector(".vote-count").innerText = `(${count} voto${count === 1 ? '' : 's'})`;
            resultDiv.querySelector(".vote-result-bar").style.width = `${pct}%`;
        }
    });
}

// Update admin statistics for votes
function updateAdminVotingUI() {
    const totalVotes = voteCounts.locas + voteCounts.university;
    
    ["locas", "university"].forEach(opt => {
        const count = voteCounts[opt];
        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        
        const textElem = document.getElementById(`admin-votes-${opt}`);
        const barElem = document.getElementById(`admin-bar-${opt}`);
        
        if (textElem) {
            textElem.innerText = `${count} voto${count === 1 ? '' : 's'} (${pct}%)`;
        }
        if (barElem) {
            barElem.style.width = `${pct}%`;
        }
    });
}

// Setup Lightbox Modal for Full Pants View
function setupImageLightbox() {
    const modal = document.getElementById("image-modal");
    const lightboxImg = document.getElementById("lightbox-img");
    const lightboxTitle = document.getElementById("lightbox-title");
    const zoomWrapper = document.getElementById("lightbox-zoom-wrapper");
    const closeBtn = document.getElementById("btn-close-image-modal");
    const lightboxVoteBtn = document.getElementById("btn-lightbox-vote");
    
    let currentOption = "";

    document.querySelectorAll(".prize-image-container.tall-image").forEach(container => {
        container.addEventListener("click", () => {
            const fullImg = container.getAttribute("data-full-img");
            const fullTitle = container.getAttribute("data-full-title");
            const card = container.closest(".option-card");
            currentOption = card ? card.id.replace("card-", "") : "";
            
            if (lightboxImg) lightboxImg.src = fullImg;
            if (lightboxTitle) lightboxTitle.innerText = fullTitle;
            if (zoomWrapper) zoomWrapper.classList.remove("zoomed");
            if (modal) modal.classList.remove("hidden");
            
            // Check if user already voted
            const hasVoted = localStorage.getItem("ssamanth_voted");
            if (lightboxVoteBtn) {
                if (hasVoted) {
                    lightboxVoteBtn.style.display = "none";
                } else {
                    lightboxVoteBtn.style.display = "inline-flex";
                    const pantName = currentOption === 'locas' ? 'Jeans "Locas"' : 'Jeans "University"';
                    lightboxVoteBtn.innerHTML = `<i class="fa-solid fa-check"></i> Votar por ${pantName}`;
                }
            }
        });
    });

    // Close button
    if (closeBtn) {
        closeBtn.addEventListener("click", () => {
            if (modal) modal.classList.add("hidden");
            if (zoomWrapper) zoomWrapper.classList.remove("zoomed");
        });
    }

    // Close on click outside the lightbox content
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                modal.classList.add("hidden");
                if (zoomWrapper) zoomWrapper.classList.remove("zoomed");
            }
        });
    }

    // Toggle zoom on clicking image container
    if (zoomWrapper) {
        zoomWrapper.addEventListener("click", (e) => {
            if (e.target.tagName === 'IMG' || e.target === zoomWrapper) {
                zoomWrapper.classList.toggle("zoomed");
            }
        });
    }

    // Quick vote action from inside the Lightbox modal
    if (lightboxVoteBtn) {
        lightboxVoteBtn.addEventListener("click", () => {
            if (currentOption) {
                const targetBtn = document.getElementById(`btn-vote-${currentOption}`);
                if (modal) modal.classList.add("hidden");
                if (targetBtn && !targetBtn.disabled) {
                    targetBtn.click();
                }
            }
        });
    }

    // Escape key closes modal
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) {
            modal.classList.add("hidden");
            if (zoomWrapper) zoomWrapper.classList.remove("zoomed");
        }
    });
}

