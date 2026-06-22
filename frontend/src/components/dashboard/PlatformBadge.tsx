'use client';

import React from 'react';

interface PlatformBadgeProps {
  platform: string;
  size?: 'sm' | 'md';
}

/**
 * PlatformBadge — Colored badge for social media platforms
 * Nhãn nền tảng với màu sắc đặc trưng:
 * - Facebook: Blue (#1877F2)
 * - TikTok: Black + gradient magenta
 * - YouTube: Red (#FF0000)
 * - News: Slate gray
 */

const PLATFORM_CONFIG: Record<string, { bg: string; text: string; emoji: string }> = {
  Facebook: {
    bg: 'bg-blue-500/10 border-blue-500/20',
    text: 'text-blue-600 dark:text-blue-400',
    emoji: '📘',
  },
  TikTok: {
    bg: 'bg-pink-500/10 border-pink-500/20',
    text: 'text-pink-600 dark:text-pink-400',
    emoji: '🎵',
  },
  YouTube: {
    bg: 'bg-red-500/10 border-red-500/20',
    text: 'text-red-600 dark:text-red-400',
    emoji: '🎬',
  },
  News: {
    bg: 'bg-gray-500/10 border-gray-500/20',
    text: 'text-gray-600 dark:text-slate-500 dark:text-gray-400',
    emoji: '📰',
  },
};

export default function PlatformBadge({ platform, size = 'sm' }: PlatformBadgeProps) {
  const config = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.News;

  const sizeClasses = size === 'md'
    ? 'px-3 py-1 text-xs'
    : 'px-2 py-0.5 text-[11px]';

  return (
    <span
      className={`
        inline-flex items-center gap-1
        ${sizeClasses}
        ${config.bg} ${config.text}
        border rounded-full font-medium
        whitespace-nowrap
      `}
    >
      <span>{config.emoji}</span>
      {platform}
    </span>
  );
}
