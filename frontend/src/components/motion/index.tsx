'use client';

import { motion, AnimatePresence, useReducedMotion, animate } from 'framer-motion';
import { ReactNode, Children, useEffect, useState, useRef } from 'react';

// FadeUp - Fade in with upward motion
interface FadeUpProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function FadeUp({ children, delay = 0, className }: FadeUpProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      {children}
    </motion.div>
  );
}

// StaggerGroup - Container that staggers children animations
interface StaggerGroupProps {
  children: ReactNode;
  staggerDelay?: number;
  className?: string;
}

export function StaggerGroup({ children, staggerDelay = 0.1, className }: StaggerGroupProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className={className}>
      {Children.map(children, (child, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: shouldReduceMotion ? 0 : index * staggerDelay }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}

// WordReveal - Reveals text word by word
interface WordRevealProps {
  text: string;
  delay?: number;
  className?: string;
}

export function WordReveal({ text, delay = 0, className }: WordRevealProps) {
  const shouldReduceMotion = useReducedMotion();
  const words = text.split(' ');

  return (
    <span className={className}>
      {words.map((word, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: 0.3,
            delay: shouldReduceMotion ? 0 : delay + index * 0.05,
          }}
          style={{ display: 'inline-block', marginRight: '0.25em' }}
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
}

// SectionReveal - Reveals sections with animation
interface SectionRevealProps {
  children: ReactNode;
  className?: string;
}

export function SectionReveal({ children, className }: SectionRevealProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.section
      className={className}
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.6 }}
    >
      {children}
    </motion.section>
  );
}

// PresenceTransition - Handles AnimatePresence transitions
interface PresenceTransitionProps {
  children: ReactNode;
  show: boolean;
  mode?: 'wait' | 'sync' | 'popLayout';
}

export function PresenceTransition({ children, show, mode = 'wait' }: PresenceTransitionProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence mode={mode}>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.95 }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// NumberReveal - Animates numbers counting up
interface NumberRevealProps {
  value: number;
  duration?: number;
  className?: string;
}

export function NumberReveal({ value, duration = 1, className }: NumberRevealProps) {
  const shouldReduceMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(value);
  const prevValue = useRef(value);

  useEffect(() => {
    if (shouldReduceMotion) {
      setDisplayValue(value);
      prevValue.current = value;
    } else {
      const controls = animate(prevValue.current, value, {
        duration,
        onUpdate: (v) => setDisplayValue(Math.round(v)),
      });
      prevValue.current = value;
      return () => controls.stop();
    }
  }, [value, shouldReduceMotion, duration]);

  return <span className={className}>{displayValue}</span>;
}

// ModalTransition - Transition for modals
interface ModalTransitionProps {
  children: ReactNode;
  show: boolean;
  onClose?: () => void;
}

export function ModalTransition({ children, show, onClose }: ModalTransitionProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.9 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// StepTransition - Transitions between steps
interface StepTransitionProps {
  children: ReactNode;
  step: number;
  direction?: 'forward' | 'backward';
}

export function StepTransition({ children, step, direction = 'forward' }: StepTransitionProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait" custom={direction}>
      <motion.div
        key={step}
        custom={direction}
        initial={{
          opacity: 0,
          x: shouldReduceMotion ? 0 : direction === 'forward' ? 50 : -50,
        }}
        animate={{ opacity: 1, x: 0 }}
        exit={{
          opacity: 0,
          x: shouldReduceMotion ? 0 : direction === 'forward' ? -50 : 50,
        }}
        transition={{ duration: 0.3 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
