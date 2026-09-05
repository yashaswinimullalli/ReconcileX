'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export default function IntroScreen() {
  const router = useRouter();
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);

  const enterApp = useCallback(() => {
    if (hasTriggered) return;
    setHasTriggered(true);
    setIsFadingOut(true);
    setTimeout(() => {
      router.push('/dashboard');
    }, 700);
  }, [hasTriggered, router]);

  // Keyboard: Enter or Space to skip
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        enterApp();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enterApp]);

  return (
    <div className={`intro-screen${isFadingOut ? ' intro-fade-out' : ''}`}>
      {/* Fullscreen Looping Video */}
      <video autoPlay loop muted playsInline className="intro-video">
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4"
          type="video/mp4"
        />
      </video>

      {/* Radial vignette overlay */}
      <div className="intro-overlay" />

      {/* Centered content stack */}
      <div className="intro-content">
        <p className="intro-label">WELCOME TO</p>
        <h1 className="intro-title">ReconcileX</h1>
        <p className="intro-tagline">AI Finance Controller</p>
        <button className="intro-enter" onClick={enterApp}>
          Enter ReconcileX<span aria-hidden="true"> →</span>
        </button>
      </div>
    </div>
  );
}
