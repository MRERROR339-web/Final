// JavaScript from himalayan-royals.js
// Import the required Firebase services.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    signInAnonymously,
    signInWithCustomToken,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    getDoc 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// Include Tone.js for sound effects.
import "https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js";

// --- Firebase Initialization ---
let db, auth;
let userId = '';
let firebaseAvailable = false;

// Check for the presence of Firebase configuration from the Canvas environment.
if (typeof __firebase_config !== 'undefined' && __firebase_config && __firebase_config !== '{}') {
    try {
        const firebaseConfig = JSON.parse(__firebase_config);
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        firebaseAvailable = true;
        console.log("Firebase initialized successfully. Data persistence is enabled.");
    } catch (e) {
        console.error("Failed to initialize Firebase:", e);
        console.error("ERROR: Failed to initialize Firebase. Data persistence will not work.");
    }
} else {
    console.warn("WARNING: Firebase configuration not found. Running in standalone mode. Data will not be saved.");
}

// --- Game Configuration ---
const segments = [
    { text: '2 XD', value: 2, chance: 37, color: '#2C3E50' },
    { text: '4 XD', value: 4, chance: 30, color: '#34495E' },
    { text: '10 XD', value: 10, chance: 10, color: '#F39C12' },
    { text: '20 XD', value: 20, chance: 5, color: '#F1C40F' },
    { text: '16 XD', value: 16, chance: 15, color: '#3498DB' },
    { text: '50 XD', value: 50, chance: 2, color: '#E74C3C' },
    { text: '100 XD', value: 100, chance: 0.9, color: '#9B59B6' },
    { text: 'Jackpot', value: 0, chance: 0.1, color: '#FFD700' },
];

const JACKPOT_INCREMENT_PER_MINUTE = 100;
const MIN_WITHDRAW_RBX = 7;
const RBX_TO_XD_RATE = 100;
const GAMEPASS_DEDUCTION_RATE = 0.40;
const REFERRAL_BONUS_RATE = 0.10;

// --- State Variables ---
let xdBalance = 500;
let jackpot = 10000;
let userReferralCode = 'GUEST-123';
let referredBy = null;
let isSpinning = false;
let notifications = [];
let username = 'Guest';

// --- Audio Context & Sound Effects ---
let spinSound, winSound;
try {
    const spinSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'square' },
        envelope: { attack: 0.05, decay: 0.1, sustain: 0.1, release: 0.1 }
    }).toDestination();
    
    spinSound = new Tone.Loop(time => {
        spinSynth.triggerAttackRelease("C4", "8n", time);
    }, "8n");

    winSound = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.005, decay: 0.5, sustain: 0.1, release: 1 }
    }).toDestination();
} catch (e) {
    console.error("Tone.js failed to initialize:", e);
}

// --- DOM Elements ---
const wheelCanvas = document.getElementById('wheelCanvas');
const ctx = wheelCanvas.getContext('2d');
const spinBtn = document.getElementById('spin-btn');
const xdBalanceEl = document.getElementById('xd-balance');
const userUsernameEl = document.getElementById('user-username');
const userReferralCodeEl = document.getElementById('user-referral-code');
const wheelContainer = document.getElementById('wheel-container');
const menuBtn = document.getElementById('menu-btn');
const sidebar = document.getElementById('sidebar');
const spinSection = document.getElementById('spin-section');
const withdrawSection = document.getElementById('withdraw-section');
const notificationSection = document.getElementById('notification-section');
const redeemAmountRbxInput = document.getElementById('redeem-amount-rbx');
const robloxUsernameInput = document.getElementById('roblox-username');
const withdrawForm = document.getElementById('withdraw-form');
const withdrawBtn = document.getElementById('withdraw-btn');
const xdDeductedAmountEl = document.getElementById('xd-deducted-amount');
const gamepassAmountEl = document.getElementById('gamepass-amount');
const notificationList = document.getElementById('notification-list');
const clearNotificationsBtn = document.getElementById('clear-notifications-btn');
const confettiCanvas = document.getElementById('confetti-canvas');
const confettiCtx = confettiCanvas.getContext('2d');

// --- Confetti VFX ---
const confettiParticles = [];
const confettiColors = ['#FFD700', '#F1C40F', '#F39C12', '#FFFFFF', '#3498DB'];
const confettiDuration = 3000;

function createConfetti() {
    for (let i = 0; i < 100; i++) {
        confettiParticles.push({
            x: Math.random() * confettiCanvas.width,
            y: Math.random() * -confettiCanvas.height,
            vx: Math.random() * 6 - 3,
            vy: Math.random() * 3 + 2,
            rot: Math.random() * 360,
            color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
            opacity: 1,
            size: Math.random() * 8 + 4
        });
    }
}

function drawConfetti() {
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    for (let i = 0; i < confettiParticles.length; i++) {
        const p = confettiParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.opacity -= 0.01;
        
        confettiCtx.save();
        confettiCtx.translate(p.x, p.y);
        confettiCtx.rotate(p.rot * Math.PI / 180);
        confettiCtx.fillStyle = p.color;
        confettiCtx.globalAlpha = p.opacity;
        confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        confettiCtx.restore();

        if (p.y > confettiCanvas.height || p.opacity <= 0) {
            confettiParticles.splice(i, 1);
            i--;
        }
    }
    if (confettiParticles.length > 0) {
        requestAnimationFrame(drawConfetti);
    }
}

function triggerConfetti() {
    createConfetti();
    drawConfetti();
    setTimeout(() => {
        confettiParticles.length = 0;
    }, confettiDuration);
}

// --- Helper Functions ---
function createLightBulbs() {
    const numBulbs = segments.length;
    const existingBulbs = wheelContainer.querySelectorAll('.light-bulb');
    existingBulbs.forEach(bulb => bulb.remove());

    const radius = 175;
    const bulbSize = 16;
    const offset = 8;
    
    for (let i = 0; i < numBulbs; i++) {
        const bulb = document.createElement('div');
        bulb.className = 'light-bulb';
        
        const angle = (i / numBulbs) * 360 - 90;
        const x = radius + radius * Math.cos(angle * Math.PI / 180);
        const y = radius + radius * Math.sin(angle * Math.PI / 180);
        
        bulb.style.top = `${y - offset}px`;
        bulb.style.left = `${x - offset}px`;
        
        wheelContainer.appendChild(bulb);
    }
}

async function fetchUserData(id) {
    if (!firebaseAvailable || !db) return null;
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const userDocRef = doc(db, `artifacts/${appId}/public/data/users`, id);
    try {
        const docSnap = await getDoc(userDocRef);
        return docSnap.exists() ? docSnap.data() : null;
    } catch (e) {
        console.error("Error fetching user data:", e);
        return null;
    }
}

async function updateUserData(id, data) {
    if (!firebaseAvailable || !db) return;
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const userDocRef = doc(db, `artifacts/${appId}/public/data/users`, id);
    try {
        await updateDoc(userDocRef, data);
    } catch (e) {
        console.error("Error updating user data:", e);
    }
}

async function createNewUser() {
    if (!firebaseAvailable || !db) return;
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const userDocRef = doc(db, `artifacts/${appId}/public/data/users`, userId);
    const userSnapshot = await getDoc(userDocRef);
    if (!userSnapshot.exists()) {
        const referralCode = `HR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const userData = {
            xdBalance: 500,
            jackpot: 10000,
            username: `Guest-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
            userReferralCode: referralCode,
            referredBy: null,
            notifications: []
        };
        await setDoc(userDocRef, userData);
        console.log("New user document created.");
    }
}

function drawWheel() {
    const totalSegments = segments.length;
    const arcSize = (2 * Math.PI) / totalSegments;
    const radius = wheelCanvas.width / 2;
    const centerX = radius;
    const centerY = radius;
    ctx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);

    const segmentsToDraw = segments.map(segment => {
        if (segment.text.startsWith('Jackpot')) {
            return { ...segment, text: `Jackpot: ${jackpot} XD` };
        }
        return segment;
    });

    segmentsToDraw.forEach((segment, i) => {
        const startAngle = i * arcSize;
        const endAngle = (i + 1) * arcSize;

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.lineTo(centerX, centerY);
        ctx.fillStyle = segment.color;
        ctx.fill();

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + arcSize / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#E0E0E0';
        ctx.font = 'bold 16px Poppins';
        ctx.fillText(segment.text, radius * 0.85, 5);
        ctx.restore();
    });

    ctx.beginPath();
    ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#FFD700';
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 12px Poppins';
    ctx.fillText('SPIN', centerX, centerY);
}

function getRandomSegment() {
    const totalChance = segments.reduce((acc, seg) => acc + seg.chance, 0);
    const rand = Math.random() * totalChance;
    let cumulativeChance = 0;
    for (const segment of segments) {
        cumulativeChance += segment.chance;
        if (rand < cumulativeChance) {
            return segment;
        }
    }
    return segments[segments.length - 1]; 
}

function spin() {
    if (isSpinning) return;
    isSpinning = true;
    spinBtn.disabled = true;
    
    try { Tone.start(); spinSound.start(); } catch (e) { /* ignore Tone.js errors */ }

    const winningSegment = getRandomSegment();
    const segmentIndex = segments.indexOf(winningSegment);
    const totalSegments = segments.length;
    const segmentArc = 360 / totalSegments;
    
    const targetAngleForSegment = (segmentIndex * segmentArc) + (segmentArc / 2);
    const finalAngle = (270 - targetAngleForSegment + 360) % 360;
    const totalRotation = 360 * 5 + finalAngle;
    
    let start = null;
    const duration = 4000;
    
    function animate(timestamp) {
        if (!start) start = timestamp;
        const elapsed = timestamp - start;
        const progress = Math.min(elapsed / duration, 1);
        
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        const rotation = easedProgress * totalRotation;
        
        wheelContainer.style.transform = `rotate(${rotation}deg)`;
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            try { spinSound.stop(); } catch (e) { /* ignore Tone.js errors */ }
            isSpinning = false;
            spinBtn.disabled = false;
            handleWin(winningSegment);
        }
    }
    requestAnimationFrame(animate);
}

async function handleWin(winningSegment) {
    let winAmount = winningSegment.value;
    let message = '';
    
    if (winningSegment.text.startsWith('Jackpot')) {
        if (jackpot > 0) {
            winAmount = jackpot;
            jackpot = 0;
            message = `Congratulations! You won the Jackpot of ${winAmount} XD!`;
            triggerConfetti();
            try { winSound.triggerAttackRelease("C5", "8n"); } catch(e) {}
        } else {
            winAmount = 0;
            message = `Sorry, the Jackpot was empty. Better luck next time!`;
        }
    } else {
        message = `You won ${winAmount} XD!`;
        try { winSound.triggerAttackRelease("G4", "8n"); } catch(e) {}
    }
    
    xdBalance += winAmount;
    
    notifications.unshift({
        message: message,
        timestamp: new Date().toISOString()
    });

    if (firebaseAvailable && userId) {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        await updateUserData(userId, { xdBalance: xdBalance, notifications: notifications, jackpot: jackpot });
    }
    
    updateUI();
}

function updateUI() {
    xdBalanceEl.textContent = xdBalance.toLocaleString();
    userUsernameEl.textContent = username;
    userReferralCodeEl.textContent = userReferralCode;
    drawWheel();

    notificationList.innerHTML = '';
    notifications.forEach(note => {
        const li = document.createElement('li');
        li.className = 'text-gray-300 p-2 border-b border-gray-700 last:border-b-0 text-sm';
        const date = new Date(note.timestamp).toLocaleString();
        li.innerHTML = `<span class="font-semibold text-yellow-500">${note.message}</span> <br> <span class="text-xs text-gray-500">${date}</span>`;
        notificationList.appendChild(li);
    });

    clearNotificationsBtn.disabled = notifications.length === 0;
    if (notifications.length > 0) {
        clearNotificationsBtn.classList.remove('disabled:bg-gray-500', 'disabled:cursor-not-allowed');
        clearNotificationsBtn.classList.add('hover:bg-red-600');
    } else {
        clearNotificationsBtn.classList.remove('hover:bg-red-600');
        clearNotificationsBtn.classList.add('disabled:bg-gray-500', 'disabled:cursor-not-allowed');
    }
}

function updateWithdrawalCalculations() {
    const amountRbx = parseInt(redeemAmountRbxInput.value, 10);
    
    if (isNaN(amountRbx) || amountRbx < MIN_WITHDRAW_RBX) {
        xdDeductedAmountEl.textContent = '0';
        gamepassAmountEl.textContent = '0';
        withdrawBtn.disabled = true;
        return;
    }

    const xdToDeduct = amountRbx * RBX_TO_XD_RATE;
    const gamepassAmount = Math.ceil(amountRbx / (1 - GAMEPASS_DEDUCTION_RATE));

    xdDeductedAmountEl.textContent = xdToDeduct.toLocaleString();
    gamepassAmountEl.textContent = gamepassAmount.toLocaleString();

    if (xdBalance >= xdToDeduct) {
        withdrawBtn.disabled = false;
    } else {
        withdrawBtn.disabled = true;
    }
}

async function handleWithdraw(e) {
    e.preventDefault();
    const amountRbx = parseInt(redeemAmountRbxInput.value, 10);
    const roboxUsername = robloxUsernameInput.value.trim();

    if (isNaN(amountRbx) || amountRbx < MIN_WITHDRAW_RBX) {
        console.log(`Withdrawal Failed: Please enter a valid amount of at least ${MIN_WITHDRAW_RBX} RBX.`);
        return;
    }

    if (roboxUsername === '') {
        console.log('Withdrawal Failed: Roblox username cannot be empty.');
        return;
    }

    const xdToDeduct = amountRbx * RBX_TO_XD_RATE;
    const gamepassAmount = Math.ceil(amountRbx / (1 - GAMEPASS_DEDUCTION_RATE));

    if (xdBalance < xdToDeduct) {
        console.log(`Withdrawal Failed: You do not have enough XD to withdraw this amount. You need ${xdToDeduct} XD.`);
        return;
    }
    
    xdBalance -= xdToDeduct;

    notifications.unshift({
        message: `Withdrawal request for ${amountRbx} RBX submitted for Roblox user "${roboxUsername}". A total of ${xdToDeduct} XD was deducted.`,
        timestamp: new Date().toISOString()
    });

    if (firebaseAvailable && userId && referredBy) {
        const bonusAmount = xdToDeduct * REFERRAL_BONUS_RATE;
        const referrerData = await fetchUserData(referredBy);
        if (referrerData) {
            const newReferrerBalance = referrerData.xdBalance + bonusAmount;
            const referrerNotifications = referrerData.notifications || [];
            referrerNotifications.unshift({
                message: `Referral bonus! You received ${bonusAmount.toFixed(0)} XD from a withdrawal by a user you referred.`,
                timestamp: new Date().toISOString()
            });
            await updateUserData(referredBy, { xdBalance: newReferrerBalance, notifications: referrerNotifications });
        }
    }

    if (firebaseAvailable && userId) {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        await updateUserData(userId, { xdBalance: xdBalance, notifications: notifications });
    }

    withdrawForm.reset();
    updateUI();
    
    console.log(`Withdrawal Successful: Your withdrawal request for ${amountRbx} RBX has been submitted. We have deducted ${xdToDeduct} XD from your balance. Please create a Gamepass of ${gamepassAmount} RBX as instructed.`);
}

async function clearNotifications() {
    notifications = [];
    if (firebaseAvailable && userId) {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        await updateUserData(userId, { notifications: notifications });
    }
    updateUI();
}

async function initializeGame() {
    if (firebaseAvailable && userId) {
        await createNewUser();
        const userData = await fetchUserData(userId);
        if (userData) {
            xdBalance = userData.xdBalance || 500;
            jackpot = userData.jackpot || 10000;
            username = userData.username || 'Guest';
            userReferralCode = userData.userReferralCode || 'GUEST-123';
            referredBy = userData.referredBy || null;
            notifications = userData.notifications || [];
        }
    }
    
    setInterval(async () => {
        jackpot += JACKPOT_INCREMENT_PER_MINUTE;
        if (firebaseAvailable && userId) {
            await updateUserData(userId, { jackpot: jackpot });
        }
        updateUI();
    }, 60 * 1000);

    updateUI();
    createLightBulbs();
    
    spinBtn.addEventListener('click', spin);
    withdrawForm.addEventListener('submit', handleWithdraw);
    clearNotificationsBtn.addEventListener('click', clearNotifications);
    redeemAmountRbxInput.addEventListener('input', updateWithdrawalCalculations);
    
    const closeMenuBtn = document.getElementById('close-menu-btn');
    const logoutBtn = document.getElementById('logout-btn');

    menuBtn.addEventListener('click', () => {
        sidebar.classList.remove('translate-x-full');
    });
    closeMenuBtn.addEventListener('click', () => {
        sidebar.classList.add('translate-x-full');
    });

    const sidebarLinks = document.querySelectorAll('#sidebar a[data-section]');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = e.target.getAttribute('data-section');
            spinSection.classList.add('hidden');
            withdrawSection.classList.add('hidden');
            notificationSection.classList.add('hidden');
            document.getElementById('policy-section').classList.add('hidden');
            document.getElementById(`${sectionId}-section`).classList.remove('hidden');
            if (sectionId === 'withdraw') {
                updateWithdrawalCalculations();
            }
            sidebar.classList.add('translate-x-full');
        });
    });

    if (firebaseAvailable) {
        logoutBtn.addEventListener('click', async () => {
            await signOut(auth);
        });
    } else {
        logoutBtn.classList.add('hidden');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;

    if (firebaseAvailable) {
        const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : '';
        try {
            if (initialAuthToken) {
                await signInWithCustomToken(auth, initialAuthToken);
            } else {
                await signInAnonymously(auth);
            }
            userId = auth.currentUser?.uid;
            
            onAuthStateChanged(auth, (user) => {
                if (user) {
                    userId = user.uid;
                    initializeGame();
                } else {
                    console.log("Authentication Required: You must be logged in to play.");
                }
            });
        } catch (error) {
            console.error("Firebase authentication failed:", error);
            console.log("Authentication Error: Failed to authenticate with Firebase. Data persistence will not work.");
            initializeGame();
        }
    } else {
        initializeGame();
    }
});
