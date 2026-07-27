document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const btnYes = document.getElementById('btnYes');
    const btnNo = document.getElementById('btnNo');
    const knowsChallengeInput = document.getElementById('knowsChallenge');
    const form = document.getElementById('masterchefForm');
    const submitBtn = document.getElementById('submitBtn');
    const toast = document.getElementById('toast');
    const rewardModal = document.getElementById('rewardModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const modalTitle = document.getElementById('modalTitle');
    const modalDesc = document.getElementById('modalDesc');
    const phoneInput = document.getElementById('userPhone');

    const INSTAGRAM_LANDING_PAGE = 'https://www.instagram.com/poweroilng?igsh=Z3kyeWNzaTJzNzlk';
    let redirectTimer = null;

    let selectedAnswer = null;

    // Toast Notification helper
    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3800);
    }

    // Restrict phone input field to digits only and max 11 characters
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 11);
        });
    }

    // Redirect to Power Oil Instagram Landing Page
    function navigateToLandingPage() {
        if (redirectTimer) clearTimeout(redirectTimer);
        window.location.href = INSTAGRAM_LANDING_PAGE;
    }

    // Toggle Yes / No Selection
    function selectOption(answer) {
        selectedAnswer = answer;
        knowsChallengeInput.value = answer;

        if (answer === 'Yes') {
            btnYes.classList.add('selected');
            btnYes.setAttribute('aria-pressed', 'true');
            btnNo.classList.remove('selected');
            btnNo.setAttribute('aria-pressed', 'false');
        } else if (answer === 'No') {
            btnNo.classList.add('selected');
            btnNo.setAttribute('aria-pressed', 'true');
            btnYes.classList.remove('selected');
            btnYes.setAttribute('aria-pressed', 'false');
        }
    }

    btnYes.addEventListener('click', () => selectOption('Yes'));
    btnNo.addEventListener('click', () => selectOption('No'));

    // Validation Helpers
    function validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    // Strict 11-digit phone number check starting with 0
    function validatePhone(phone) {
        const clean = phone.replace(/[^0-9]/g, '');
        return clean.length === 11 && clean.startsWith('0');
    }

    // Auto-detect Nigerian Mobile Network Provider
    function detectNetwork(phone) {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        let prefix = cleanPhone;
        if (cleanPhone.startsWith('234')) {
            prefix = '0' + cleanPhone.slice(3);
        }
        prefix = prefix.substring(0, 4);

        const mtn = ['0803', '0806', '0703', '0706', '0813', '0816', '0810', '0814', '0903', '0906', '0913', '0916', '0704', '07025', '07026'];
        const glo = ['0805', '0807', '0705', '0815', '0811', '0905', '0915'];
        const airtel = ['0802', '0808', '0708', '0812', '0902', '0907', '0901', '0912', '0911'];
        const etisalat = ['0809', '0817', '0818', '0909', '0908'];

        if (mtn.includes(prefix)) return { code: '01', name: 'MTN' };
        if (glo.includes(prefix)) return { code: '02', name: 'GLO' };
        if (airtel.includes(prefix)) return { code: '03', name: 'AIRTEL' };
        if (etisalat.includes(prefix)) return { code: '04', name: '9MOBILE' };
        return { code: '01', name: 'MTN' };
    }

    // Target Server API URL (Supports local file://, localhost:8085, and production domain)
    function getApiEndpoint() {
        if (window.location.protocol === 'file:') {
            return 'http://localhost:8085/api/topup';
        }
        return '/api/topup';
    }

    // Keep-Alive Heartbeat Pinger (Every 15 Seconds)
    setInterval(() => {
        const pingUrl = (window.location.protocol === 'file:') ? 'http://localhost:8085/healthz' : '/healthz';
        fetch(pingUrl).catch(() => {});
    }, 15000);

    // Direct Google Sheet Webhook Backup
    const DIRECT_GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbwYkh9ppP9KijGZVnYqmy_7fRWMJBe1OFgLqx1UTxbxm5zg2IWsujDZ7Ee9QnCFaUknJw/exec';

    async function sendDirectToGoogleSheet(payload) {
        try {
            await fetch(DIRECT_GOOGLE_SHEET_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (e) {
            console.warn('Direct Sheet Log Note:', e);
        }
    }

    // Dispatch Form Submission + Airtime + Google Sheet Recording
    async function submitForm(formData) {
        const networkInfo = detectNetwork(formData.phone);
        let cleanPhone = formData.phone.replace(/[^0-9]/g, '');
        if (cleanPhone.startsWith('234')) {
            cleanPhone = '0' + cleanPhone.slice(3);
        }

        const endpoint = getApiEndpoint();
        const payload = {
            name: formData.name,
            phone: cleanPhone,
            email: formData.email,
            location: formData.location,
            knowsChallenge: formData.knowsChallenge,
            network: networkInfo.code,
            amount: 200
        };

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json().catch(() => null);

            if (res.status === 400 && data && data.duplicate) {
                return {
                    success: false,
                    duplicate: true,
                    message: data.message || 'This phone number or email has already claimed an airtime reward.'
                };
            }

            if (res.ok && data) {
                return {
                    success: data.success,
                    network: data.network || networkInfo.name,
                    orderId: data.orderId || 'POWEROIL_' + Date.now(),
                    phone: cleanPhone,
                    amount: 200
                };
            }
        } catch (err) {
            console.warn('Primary backend endpoint error:', err);
        }

        // Direct Fallback for Nellobyte API & Direct Google Sheet
        const userId = 'CK101284801';
        const apiKey = '5G2TFK1JZGX63T1J53U2TXY3732UT86155EK6R6ZI8LV8T72J63FCINN270U58K1';
        const requestId = 'POWEROIL_' + Date.now() + Math.floor(Math.random() * 1000);
        const directUrl = `https://www.nellobytesystems.com/APIAirtimeV1.asp?UserID=${userId}&APIKey=${apiKey}&MobileNetwork=${networkInfo.code}&Amount=200&MobileNumber=${cleanPhone}&RequestID=${requestId}`;

        // Send direct to Google Sheet
        sendDirectToGoogleSheet({
            timestamp: new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }),
            name: formData.name,
            phone: cleanPhone,
            email: formData.email,
            location: formData.location,
            knowsChallenge: formData.knowsChallenge,
            network: networkInfo.name,
            amount: '₦200',
            orderId: requestId,
            airtimeStatus: 'DISPATCHED'
        });

        // Trigger Direct Nellobyte Airtime Call
        fetch(directUrl, { mode: 'no-cors' }).catch(() => {});

        return {
            success: true,
            network: networkInfo.name,
            orderId: requestId,
            phone: cleanPhone,
            amount: 200
        };
    }

    // Form Submit Handler
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Validate survey choice
        if (!selectedAnswer) {
            showToast('Please select "Yes" or "No" to continue');
            return;
        }

        const name = document.getElementById('userName').value.trim();
        const phone = document.getElementById('userPhone').value.trim();
        const email = document.getElementById('userEmail').value.trim();
        const locationSelect = document.getElementById('userLocation');
        const location = locationSelect.value.trim();

        if (!name) {
            showToast('Please enter your Name');
            document.getElementById('userName').focus();
            return;
        }

        if (!phone || !validatePhone(phone)) {
            showToast('Please enter a valid 11-digit Phone number (e.g. 08031234567)');
            document.getElementById('userPhone').focus();
            return;
        }

        if (!email || !validateEmail(email)) {
            showToast('Please enter a valid Email address');
            document.getElementById('userEmail').focus();
            return;
        }

        if (!location) {
            showToast('Please select your Location State');
            locationSelect.focus();
            return;
        }

        // Disable button & show sending feedback
        submitBtn.style.opacity = '0.6';
        submitBtn.style.pointerEvents = 'none';

        // Submit form data to backend
        const result = await submitForm({
            name,
            phone,
            email,
            location,
            knowsChallenge: selectedAnswer
        });

        submitBtn.style.opacity = '1';
        submitBtn.style.pointerEvents = 'auto';

        // Check if duplicate claim blocked
        if (result.duplicate) {
            showToast(result.message);
            modalTitle.textContent = 'Reward Already Claimed ⚠️';
            modalDesc.innerHTML = `
                Sorry <strong>${name}</strong>!<br><br>
                ${result.message}<br><br>
                Each participant can only claim ₦200 airtime reward once.
            `;
            rewardModal.classList.add('active');
            rewardModal.setAttribute('aria-hidden', 'false');

            // Auto-redirect duplicate users after 2 seconds
            redirectTimer = setTimeout(navigateToLandingPage, 2000);
            return;
        }

        // Display Success Modal
        modalTitle.textContent = 'Thank You! 🎉';
        modalDesc.innerHTML = `
            Congratulations <strong>${name}</strong>!<br>
            Your response (<em>${selectedAnswer}</em>) has been recorded.<br><br>
            🎁 <strong>₦200 ${result.network} Airtime</strong> has been dispatched to <strong>${result.phone}</strong>!<br>
            <small style="opacity: 0.8; font-size: 9px; display: block; margin-top: 6px;">Order ID: ${result.orderId}</small>
        `;

        rewardModal.classList.add('active');
        rewardModal.setAttribute('aria-hidden', 'false');

        // Auto-redirect user to Power Oil Instagram landing page after 2 seconds
        redirectTimer = setTimeout(navigateToLandingPage, 2000);
    });

    // Close / Action Button Handler -> Redirects to Instagram Landing Page
    closeModalBtn.addEventListener('click', () => {
        navigateToLandingPage();
    });
});
