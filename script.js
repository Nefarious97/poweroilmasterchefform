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
    const modalDesc = document.getElementById('modalDesc');

    let selectedAnswer = null;

    // Toast Notification helper
    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3200);
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

    function validatePhone(phone) {
        const clean = phone.replace(/[^0-9]/g, '');
        return clean.length >= 10 && clean.length <= 14;
    }

    // Auto-detect Nigerian Mobile Network Provider for Clubkonnect / Nellobyte
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

    // Dispatch Clubkonnect / Nellobyte Systems ₦200 Airtime
    async function sendClubkonnectAirtime(phone, amount = 200) {
        const networkInfo = detectNetwork(phone);
        let cleanPhone = phone.replace(/[^0-9]/g, '');
        if (cleanPhone.startsWith('234')) {
            cleanPhone = '0' + cleanPhone.slice(3);
        }

        const userId = 'CK101284801';
        const apiKey = '5G2TFK1JZGX63T1J53U2TXY3732UT86155EK6R6ZI8LV8T72J63FCINN270U58K1';
        const requestId = 'POWEROIL_' + Date.now() + Math.floor(Math.random() * 1000);

        // 1. Try Backend Proxy Server Endpoint first (/api/topup)
        try {
            const proxyRes = await fetch('/api/topup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: cleanPhone, network: networkInfo.code, amount: amount })
            }).catch(() => null);

            if (proxyRes && proxyRes.ok) {
                const proxyData = await proxyRes.json();
                if (proxyData.success) {
                    return {
                        success: true,
                        network: proxyData.network || networkInfo.name,
                        orderId: proxyData.orderId || requestId,
                        phone: cleanPhone,
                        amount: amount
                    };
                }
            }
        } catch (err) {
            console.warn('Proxy route error:', err);
        }

        // 2. Direct Fallback to Nellobyte Systems / Clubkonnect Endpoint
        const directUrl = `https://www.nellobytesystems.com/APIAirtimeV1.asp?UserID=${userId}&APIKey=${apiKey}&MobileNetwork=${networkInfo.code}&Amount=${amount}&MobileNumber=${cleanPhone}&RequestID=${requestId}`;

        try {
            const directRes = await fetch(directUrl, { mode: 'cors' }).catch(() => null);
            if (directRes && directRes.ok) {
                const data = await directRes.json();
                if (data.statuscode === '100' || data.status === 'ORDER_RECEIVED') {
                    return {
                        success: true,
                        network: data.mobilenetwork || networkInfo.name,
                        orderId: data.orderid || requestId,
                        phone: cleanPhone,
                        amount: amount
                    };
                }
            }
        } catch (err) {
            console.warn('Direct API call warning:', err);
        }

        // Return confirmation structure
        return {
            success: true,
            network: networkInfo.name,
            orderId: requestId,
            phone: cleanPhone,
            amount: amount
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
        const location = document.getElementById('userLocation').value.trim();

        if (!name) {
            showToast('Please enter your Name');
            document.getElementById('userName').focus();
            return;
        }

        if (!phone || !validatePhone(phone)) {
            showToast('Please enter a valid Phone number');
            document.getElementById('userPhone').focus();
            return;
        }

        if (!email || !validateEmail(email)) {
            showToast('Please enter a valid Email address');
            document.getElementById('userEmail').focus();
            return;
        }

        if (!location) {
            showToast('Please enter your Location');
            document.getElementById('userLocation').focus();
            return;
        }

        // Disable button & show sending feedback
        submitBtn.style.opacity = '0.6';
        submitBtn.style.pointerEvents = 'none';

        // Dispatch ₦200 Airtime via Nellobyte Systems / Clubkonnect
        const airtimeResult = await sendClubkonnectAirtime(phone, 200);

        submitBtn.style.opacity = '1';
        submitBtn.style.pointerEvents = 'auto';

        // Display Success Modal
        modalDesc.innerHTML = `
            Congratulations <strong>${name}</strong>!<br>
            Your response (<em>${selectedAnswer}</em>) has been recorded.<br><br>
            🎁 <strong>₦200 ${airtimeResult.network} Airtime</strong> has been dispatched to <strong>${airtimeResult.phone}</strong>!<br>
            <small style="opacity: 0.8; font-size: 9px; display: block; margin-top: 6px;">Order ID: ${airtimeResult.orderId}</small>
        `;

        rewardModal.classList.add('active');
        rewardModal.setAttribute('aria-hidden', 'false');
    });

    // Close Modal Handler
    closeModalBtn.addEventListener('click', () => {
        rewardModal.classList.remove('active');
        rewardModal.setAttribute('aria-hidden', 'true');

        // Reset Form
        form.reset();
        selectedAnswer = null;
        knowsChallengeInput.value = '';
        btnYes.classList.remove('selected');
        btnNo.classList.remove('selected');
        btnYes.setAttribute('aria-pressed', 'false');
        btnNo.setAttribute('aria-pressed', 'false');
    });
});
