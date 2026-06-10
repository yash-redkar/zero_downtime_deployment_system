"use client"

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Activity, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  RotateCw, 
  HelpCircle, 
  Zap, 
  ShieldCheck, 
  ArrowRightLeft 
} from 'lucide-react'
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts'

interface Particle {
  id: number
  left: number
  bottom: number
  size: number
  duration: number
  delay: number
}

interface Step {
  id: number
  name: string
  status: 'complete' | 'active' | 'waiting'
  info: string
  color: string
}

interface MetricHistory {
  errorRate: number
  latency: number
  cpu: number
  memory: number
}

export default function SmartDeployDashboard() {
  // --- Time & Status State ---
  const [utcTime, setUtcTime] = useState<string>('')
  
  // --- Inject Fault States ---
  const [isFaultInjected, setIsFaultInjected] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [isRecovering, setIsRecovering] = useState(false)

  // --- Metrics ---
  const [metrics, setMetrics] = useState({
    errorRate: 0.4,
    latency: 54,
    cpu: 43,
    memory: 64,
  })

  // --- Traffic Split state derived from clock & fault status ---
  const [trafficSplit, setTrafficSplit] = useState({ v1: 90, v2: 10 })
  const [timeSlotLabel, setTimeSlotLabel] = useState('PEAK HOURS')

  // --- Error History for the Sparkline (last 60 data points) ---
  const [errorHistory, setErrorHistory] = useState<{ value: number }[]>([])

  // --- Particles array (static layout generated once on client) ---
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    // Generate star particles
    const generated: Particle[] = Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      bottom: Math.random() * 20 - 10,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 12 + 8, // 8-20s
      delay: Math.random() * -20, // Negative delay to start immediately
    }))
    setParticles(generated)

    // Clock
    const timer = setInterval(() => {
      const now = new Date()
      setUtcTime(now.toUTCString().replace('GMT', 'UTC'))
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // --- Metric updates & scheduler every 2s ---
  useEffect(() => {
    // Initialize error history with normal values
    const initialHistory = Array.from({ length: 60 }).map(() => ({
      value: 0.1 + Math.random() * 0.7
    }))
    setErrorHistory(initialHistory)

    const interval = setInterval(() => {
      const now = new Date()
      const hours = now.getUTCHours()

      // Determine Time Slot & Target Canary Split
      let slot = 'PEAK HOURS'
      let targetV2 = 10
      if (hours >= 18 && hours < 23) {
        slot = 'OFF-PEAK'
        targetV2 = 30
      } else if (hours >= 23 || hours < 9) {
        slot = 'NIGHT MODE'
        targetV2 = 60
      }
      setTimeSlotLabel(slot)

      // If fault is injected, error rate spikes, otherwise normal fluctuation
      setMetrics(prev => {
        if (isFaultInjected) {
          return {
            errorRate: 4.2 + (Math.random() * 0.3 - 0.15),
            latency: 280 + Math.random() * 20,
            cpu: 89 + Math.random() * 5,
            memory: 85 + Math.random() * 3,
          }
        }
        return {
          errorRate: Math.max(0.1, Math.min(0.8, prev.errorRate + (Math.random() * 0.2 - 0.1))),
          latency: Math.max(42, Math.min(68, prev.latency + Math.round(Math.random() * 6 - 3))),
          cpu: Math.max(34, Math.min(52, prev.cpu + Math.round(Math.random() * 4 - 2))),
          memory: Math.max(58, Math.min(71, prev.memory + Math.round(Math.random() * 2 - 1))),
        }
      })

      // Traffic split updates based on normal/fault mode
      setTrafficSplit(prev => {
        if (isFaultInjected) {
          // Fault causes auto-rollback to 100% v1 / 0% v2
          return { v1: 100, v2: 0 }
        }
        return { v1: 100 - targetV2, v2: targetV2 }
      })

      // Update error history
      setErrorHistory(prev => {
        const nextVal = isFaultInjected 
          ? 4.2 + (Math.random() * 0.4 - 0.2)
          : Math.max(0.1, Math.min(0.8, (prev[prev.length - 1]?.value || 0.4) + (Math.random() * 0.2 - 0.1)))
        
        const nextHistory = [...prev.slice(1), { value: nextVal }]
        return nextHistory
      })

    }, 2000)

    return () => clearInterval(interval)
  }, [isFaultInjected])

  // --- Compute ML Health Score ---
  // score = (100 - errorRate * 2) * 0.4 + (100 - latency / 10) * 0.3 + (100 - cpu) * 0.2 + (100 - memory) * 0.1
  // If fault is injected, we drop it to 24 (or let formula resolve but clamp it)
  const computedScore = Math.max(0, Math.min(100, Math.round(
    (100 - metrics.errorRate * 2) * 0.4 +
    (100 - metrics.latency / 10) * 0.3 +
    (100 - metrics.cpu) * 0.2 +
    (100 - metrics.memory) * 0.1
  )))

  // Score transitions
  let ringColor = 'var(--cyan)'
  let glowClass = 'pulse-cyan'
  if (computedScore < 40) {
    ringColor = 'var(--red)'
    glowClass = 'pulse-red'
  } else if (computedScore < 70) {
    ringColor = 'var(--amber)'
    glowClass = 'pulse-amber'
  }

  // --- Handle Fault Injection ---
  const handleInjectFault = () => {
    if (isFaultInjected || isRecovering) return
    setIsFaultInjected(true)

    // Override metrics immediately for visual snap
    setMetrics({
      errorRate: 4.2,
      latency: 282,
      cpu: 89,
      memory: 85,
    })
    
    setErrorHistory(prev => [...prev.slice(1), { value: 4.2 }])

    // Wait 5s to show rollback toast
    setTimeout(() => {
      setShowToast(true)
      setIsRecovering(true)
      setIsFaultInjected(false)

      // Rollback restores metrics gradually over 3s
      setTimeout(() => {
        setShowToast(false)
        setIsRecovering(false)
      }, 5000)
    }, 5000)
  }

  // Pipeline steps
  const pipelineSteps: Step[] = [
    { id: 1, name: 'Code push', status: 'complete', info: '2s ago', color: 'var(--green)' },
    { id: 2, name: 'Tests passed', status: 'complete', info: '14s', color: 'var(--green)' },
    { id: 3, name: 'Trivy scan', status: 'complete', info: 'clean', color: 'var(--green)' },
    { id: 4, name: 'Docker build', status: 'complete', info: 'done', color: 'var(--green)' },
    { 
      id: 5, 
      name: 'Canary deploy', 
      status: isFaultInjected ? 'waiting' : 'active', 
      info: isFaultInjected ? 'halted' : 'running...', 
      color: isFaultInjected ? 'var(--red)' : 'var(--cyan)' 
    },
    { id: 6, name: 'Health check', status: 'waiting', info: 'waiting', color: 'var(--dim)' },
    { id: 7, name: 'Promote / Rollback', status: 'waiting', info: 'waiting', color: 'var(--dim)' },
  ]

  // SVG ring properties
  const radius = 90
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (computedScore / 100) * circumference

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Stars Background */}
      <div id="particles">
        {particles.map(p => (
          <div
            key={p.id}
            className="particle"
            style={{
              left: `${p.left}%`,
              bottom: `${p.bottom}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Slide-Down Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ y: -80, opacity: 0, x: '-50%' }}
            animate={{ y: 20, opacity: 1, x: '-50%' }}
            exit={{ y: -80, opacity: 0, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            style={{
              position: 'fixed',
              top: 0,
              left: '50%',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'rgba(8, 11, 20, 0.95)',
              border: '1px solid var(--green)',
              boxShadow: '0 0 30px rgba(16, 245, 140, 0.25)',
              borderRadius: '12px',
              padding: '14px 28px',
              backdropFilter: 'blur(24px)',
            }}
          >
            <ShieldCheck size={20} color="var(--green)" />
            <span style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', color: '#FFF' }}>
              🛡 Auto-rollback complete · <span style={{ color: 'var(--green)' }}>v1 restored</span> · 0 users affected
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SECTION 1 — TOP NAV BAR */}
      <header
        style={{
          height: '56px',
          background: 'rgba(0, 217, 255, 0.04)',
          borderBottom: '1px solid rgba(0, 217, 255, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          zIndex: 10,
        }}
      >
        {/* Left: Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="neon-title" style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', fontSize: '18px' }}>
            ◈ SmartDeploy
          </span>
        </div>

        {/* Center: System Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isFaultInjected ? 'var(--red)' : 'var(--green)',
              boxShadow: isFaultInjected ? '0 0 10px var(--red)' : '0 0 10px var(--green)',
              animation: 'blink 1.5s infinite',
            }}
          />
          <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', color: isFaultInjected ? 'var(--red)' : 'var(--green)' }}>
            {isFaultInjected ? 'SYSTEM ANOMALY DETECTED' : 'ALL SYSTEMS OPERATIONAL'}
          </span>
        </div>

        {/* Right: Badges & Clock */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              border: '1px solid var(--purple)',
              color: 'var(--purple)',
              padding: '2px 8px',
              borderRadius: '4px',
              background: 'rgba(139, 92, 246, 0.05)',
            }}
          >
            v2.1.0
          </div>
          <div
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              border: '1px solid var(--cyan)',
              color: 'var(--cyan)',
              padding: '2px 8px',
              borderRadius: '4px',
              background: 'rgba(0, 217, 255, 0.05)',
            }}
          >
            CANARY
          </div>
          <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.7)', minWidth: '170px', textAlign: 'right' }}>
            {utcTime || 'CONNECTING...'}
          </div>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <main
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateRows: '1fr auto',
          padding: '24px',
          gap: '24px',
          zIndex: 5,
          maxHeight: 'calc(100vh - 56px)',
        }}
      >
        {/* TOP PANEL: 3 COLUMNS */}
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 320px', gap: '24px', minHeight: 0 }}>
          
          {/* SECTION 2 — LEFT PANEL: Rollout Stage */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
            <h2 style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(0, 217, 255, 0.7)' }}>
              ROLLOUT STAGE
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, justifyContent: 'center' }}>
              
              {/* Card 1 — Internal */}
              <motion.div
                whileHover={{ y: -6, scale: 1.01 }}
                className="glass float-a"
                style={{
                  border: isFaultInjected ? '1px solid rgba(255, 71, 87, 0.3)' : '1px solid var(--cyan)',
                  boxShadow: isFaultInjected ? 'none' : '0 0 15px rgba(0, 217, 255, 0.1)',
                  position: 'relative',
                  opacity: isFaultInjected ? 0.4 : 1,
                  transition: 'opacity 0.5s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>GATE 01</span>
                  <span 
                    style={{ 
                      fontSize: '11px', 
                      fontFamily: 'var(--font-mono)', 
                      color: isFaultInjected ? 'var(--red)' : 'var(--cyan)',
                      textShadow: isFaultInjected ? 'none' : '0 0 8px rgba(0,217,255,0.5)'
                    }}
                  >
                    {isFaultInjected ? '⚠ WARNING' : '✦ ACTIVE'}
                  </span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#FFF' }}>Internal</h3>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>42 engineers</p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>dogfooding v2 since 3 days</p>
              </motion.div>

              {/* Card 2 — Beta */}
              <motion.div
                whileHover={{ y: -6, scale: 1.01 }}
                className="glass float-b"
                style={{ opacity: isFaultInjected ? 0.3 : 0.7, transition: 'opacity 0.5s' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.3)' }}>GATE 02</span>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.4)' }}>
                    ○ PENDING
                  </span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#FFF' }}>Beta</h3>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>1,200 beta users</p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>awaiting promotion</p>
              </motion.div>

              {/* Card 3 — Public */}
              <motion.div
                whileHover={{ y: -6, scale: 1.01 }}
                className="glass float-c"
                style={{ opacity: isFaultInjected ? 0.3 : 0.6, transition: 'opacity 0.5s' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.3)' }}>GATE 03</span>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.3)' }}>
                    ⊘ LOCKED
                  </span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#FFF' }}>Public</h3>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>General public</p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>health score must reach 85</p>
              </motion.div>

            </div>
          </div>

          {/* SECTION 3 — CENTER PANEL: Health Score */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', alignItems: 'center' }}>
            <h2 style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(0, 217, 255, 0.7)', width: '100%', textAlign: 'center' }}>
              ML HEALTH SCORE
            </h2>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%', alignItems: 'center' }}>
              {/* Ring + Orbs container */}
              <div style={{ position: 'relative', width: '360px', height: '360px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                
                {/* SVG Ring */}
                <svg width="240" height="240" viewBox="0 0 240 240" style={{ transform: 'rotate(-90deg)' }}>
                  {/* Track Ring */}
                  <circle
                    cx="120"
                    cy="120"
                    r={radius}
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="12"
                    fill="transparent"
                  />
                  {/* Score Ring with Glow */}
                  <motion.circle
                    cx="120"
                    cy="120"
                    r={radius}
                    stroke={ringColor}
                    strokeWidth="12"
                    fill="transparent"
                    strokeDasharray={circumference}
                    animate={{ strokeDashoffset }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                    strokeLinecap="round"
                    style={{
                      filter: `drop-shadow(0 0 8px ${ringColor})`,
                    }}
                  />
                </svg>

                {/* Score Info inside Ring */}
                <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                  <motion.span 
                    key={computedScore}
                    initial={{ scale: 0.8, opacity: 0.5 }}
                    animate={{ scale: 1, opacity: 1 }}
                    style={{ 
                      fontSize: '52px', 
                      fontWeight: 'bold', 
                      fontFamily: 'var(--font-mono)', 
                      color: ringColor, 
                      textShadow: `0 0 15px ${ringColor}80` 
                    }}
                  >
                    {computedScore}
                  </motion.span>
                  <span style={{ fontSize: '10px', letterSpacing: '0.1em', fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                    ML CONFIDENCE
                  </span>
                  <span style={{ fontSize: '8px', letterSpacing: '0.05em', color: 'var(--cyan)', opacity: 0.8, animation: 'blink 2s infinite', marginTop: '2px' }}>
                    anomaly detection active
                  </span>
                </div>

                {/* --- Four Orbs Floating Around --- */}
                {/* TOP ORB: Error Rate */}
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className={`glass ${glowClass}`}
                  style={{
                    position: 'absolute',
                    top: '-10px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '105px',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    textAlign: 'center',
                    border: `1px solid ${computedScore < 40 ? 'var(--red)' : 'rgba(0, 217, 255, 0.2)'}`,
                  }}
                >
                  <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Error Rate</p>
                  <p style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', color: metrics.errorRate > 2 ? 'var(--red)' : 'var(--cyan)', fontWeight: 'bold' }}>
                    {metrics.errorRate.toFixed(2)}%
                  </p>
                </motion.div>

                {/* RIGHT ORB: Latency */}
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="glass"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    right: '-25px',
                    transform: 'translateY(-50%)',
                    width: '100px',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    textAlign: 'center',
                  }}
                >
                  <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Latency</p>
                  <p style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', color: 'var(--cyan)', fontWeight: 'bold' }}>
                    {metrics.latency}ms
                  </p>
                </motion.div>

                {/* BOTTOM ORB: CPU */}
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="glass"
                  style={{
                    position: 'absolute',
                    bottom: '-10px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '100px',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    textAlign: 'center',
                  }}
                >
                  <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>CPU</p>
                  <p style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', color: 'var(--cyan)', fontWeight: 'bold' }}>
                    {metrics.cpu}%
                  </p>
                </motion.div>

                {/* LEFT ORB: Memory */}
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="glass"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '-25px',
                    transform: 'translateY(-50%)',
                    width: '100px',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    textAlign: 'center',
                  }}
                >
                  <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Memory</p>
                  <p style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', color: 'var(--cyan)', fontWeight: 'bold' }}>
                    {metrics.memory}%
                  </p>
                </motion.div>

              </div>

              {/* Below the ring — Traffic Time Scheduler */}
              <div style={{ marginTop: '24px', width: '100%', maxWidth: '340px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.6)' }}>
                    <Clock size={14} color="var(--cyan)" />
                    <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>
                      {timeSlotLabel}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>
                    Canary gets {trafficSplit.v2}%
                  </span>
                </div>

                {/* Traffic Split Bar */}
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                  <div 
                    style={{ 
                      width: `${trafficSplit.v1}%`, 
                      background: 'var(--cyan)', 
                      boxShadow: '0 0 10px rgba(0, 217, 255, 0.5)',
                      transition: 'width 1s ease-in-out'
                    }} 
                  />
                  <div 
                    style={{ 
                      width: `${trafficSplit.v2}%`, 
                      background: 'var(--purple)', 
                      boxShadow: '0 0 10px rgba(139, 92, 246, 0.5)',
                      transition: 'width 1s ease-in-out' 
                    }} 
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}>
                  <span>v1 STABLE ({trafficSplit.v1}%)</span>
                  <span>v2 CANARY ({trafficSplit.v2}%)</span>
                </div>
              </div>

            </div>
          </div>

          {/* SECTION 4 — RIGHT PANEL: Live Pipeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
            <h2 style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(0, 217, 255, 0.7)' }}>
              DEPLOYMENT PIPELINE
            </h2>

            <div className="glass" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative' }}>
              
              {/* Vertical line connecting steps */}
              <div 
                style={{ 
                  position: 'absolute', 
                  left: '30px', 
                  top: '35px', 
                  bottom: '35px', 
                  width: '2px', 
                  background: 'repeating-linear-gradient(to bottom, transparent, transparent 4px, rgba(0, 217, 255, 0.2) 4px, rgba(0, 217, 255, 0.2) 8px)',
                  zIndex: 0 
                }} 
              />

              {pipelineSteps.map((step, idx) => {
                const isActive = step.status === 'active'
                const isComplete = step.status === 'complete'

                return (
                  <div 
                    key={step.id} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '16px', 
                      zIndex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      borderLeft: isActive ? '3px solid var(--cyan)' : '3px solid transparent',
                      background: isActive ? 'rgba(0, 217, 255, 0.05)' : 'transparent',
                      boxShadow: isActive ? '0 0 15px rgba(0, 217, 255, 0.05)' : 'none',
                      transition: 'all 0.3s',
                    }}
                  >
                    {/* Circle Indicator */}
                    <div 
                      style={{ 
                        width: '22px', 
                        height: '22px', 
                        borderRadius: '50%', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        background: isComplete ? 'rgba(16, 245, 140, 0.1)' : isActive ? 'rgba(0, 217, 255, 0.1)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${isComplete ? 'var(--green)' : isActive ? 'var(--cyan)' : 'var(--dim)'}`,
                        boxShadow: isActive ? '0 0 8px var(--cyan)' : 'none',
                      }}
                    >
                      {isComplete ? (
                        <CheckCircle2 size={12} color="var(--green)" />
                      ) : isActive ? (
                        <RotateCw size={12} color="var(--cyan)" style={{ animation: 'spin 2s linear infinite' }} />
                      ) : (
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
                      )}
                    </div>

                    {/* Info text */}
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: isComplete ? '#FFF' : isActive ? 'var(--cyan)' : 'rgba(255,255,255,0.5)' }}>
                        {step.name}
                      </p>
                      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}>
                        {step.info}
                      </span>
                    </div>
                  </div>
                )
              })}

            </div>
          </div>

        </div>

        {/* SECTION 5 — BOTTOM PANEL: Rollback Engine */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', position: 'relative' }}>
          
          {/* Left Half: Version Comparison & Traffic Donut */}
          <div className="glass" style={{ display: 'flex', alignItems: 'center', gap: '24px', height: '145px', overflow: 'hidden' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(0, 217, 255, 0.7)', textTransform: 'uppercase', marginBottom: '8px' }}>
                VERSION TRAFFIC DISTRIBUTION
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                <div>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--cyan)' }}>v1 STABLE</span>
                  <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}>
                    Production baseline
                  </p>
                </div>
                <ArrowRightLeft size={16} color="rgba(255,255,255,0.3)" />
                <div>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--purple)' }}>v2 CANARY</span>
                  <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}>
                    Active Release Candidate
                  </p>
                </div>
              </div>
              <p style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.5)', marginTop: '14px' }}>
                Current: {trafficSplit.v1}% / {trafficSplit.v2}% split
              </p>
            </div>

            <div style={{ width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'v1', value: trafficSplit.v1 },
                      { name: 'v2', value: trafficSplit.v2 }
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={45}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    <Cell fill="var(--cyan)" />
                    <Cell fill="var(--purple)" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.6)' }}>
                {trafficSplit.v2}%
              </div>
            </div>
          </div>

          {/* Right Half: Live Error Rate Graph */}
          <div className="glass" style={{ display: 'flex', flexDirection: 'column', height: '145px', overflow: 'hidden' }}>
            <h3 style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(0, 217, 255, 0.7)', textTransform: 'uppercase', marginBottom: '4px' }}>
              LIVE ERROR RATE SPARKLINE (60s)
            </h3>
            
            <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={errorHistory}>
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke={isFaultInjected ? 'var(--red)' : 'var(--cyan)'} 
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', right: '12px', bottom: '12px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: isFaultInjected ? 'var(--red)' : 'var(--cyan)' }}>
                {metrics.errorRate.toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Center Bottom: Inject Fault Trigger */}
          <div 
            style={{ 
              position: 'absolute', 
              left: '50%', 
              bottom: '-12px', 
              transform: 'translateX(-50%)', 
              zIndex: 20 
            }}
          >
            <button
              onClick={handleInjectFault}
              disabled={isFaultInjected || isRecovering}
              className="glass"
              style={{
                background: isFaultInjected 
                  ? 'rgba(255,71,87,0.3)' 
                  : isRecovering
                    ? 'rgba(16,245,140,0.1)'
                    : 'rgba(255,71,87,0.15)',
                border: `1px solid ${isRecovering ? 'var(--green)' : '#FF4757'}`,
                boxShadow: isFaultInjected 
                  ? '0 0 30px rgba(255,71,87,0.8)' 
                  : isRecovering
                    ? '0 0 30px rgba(16,245,140,0.4)'
                    : '0 0 20px rgba(255,71,87,0.4)',
                padding: '10px 24px',
                borderRadius: '30px',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                fontWeight: 'bold',
                color: isRecovering ? 'var(--green)' : '#FF4757',
                cursor: (isFaultInjected || isRecovering) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                outline: 'none',
                transition: 'all 0.3s',
              }}
            >
              <Zap size={14} fill="currentColor" />
              {isFaultInjected 
                ? 'ROLLBACK IN PROGRESS...' 
                : isRecovering 
                  ? 'RESTORES ACTIVE' 
                  : 'INJECT FAULT'}
            </button>
          </div>

        </div>

      </main>
    </div>
  )
}
