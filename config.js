// Settings for this deployment. None of these are secrets: the Firebase web
// config only names the project (access is decided by firestore.rules), and the
// AI address checks every caller's sign-in before it does anything.
(function () {
  'use strict';
  var Tab = window.Tab = window.Tab || {};

  // On this computer, http://localhost:8765/?emu talks to the Firebase emulators
  // (firebase emulators:start --project demo-tab) instead of the real project.
  var emulator = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]emu\b/.test(location.search);

  Tab.config = {
    firebase: emulator ? { apiKey: 'demo', authDomain: 'demo-tab.firebaseapp.com', projectId: 'demo-tab' } : {
      apiKey: 'AIzaSyDYNQZuvRHzsWFHZomxqUhDiqyFBWw2Fp4',
      authDomain: 'tab-bill-splitter.firebaseapp.com',
      projectId: 'tab-bill-splitter',
      appId: '1:725374171834:web:8bf44d8ca40788d620a083'
    },
    // The Apps Script web app that reads receipts and runs the bill assistant (proxy/).
    aiUrl: 'https://script.google.com/macros/s/AKfycbw3XwfkquB5oCPlYTSDwwykC8Zi6Un_o-rQL-5KlWDaQUVj-jS9IKJy1W4cxvfHGcFj/exec',
    emulator: emulator
  };
})();
