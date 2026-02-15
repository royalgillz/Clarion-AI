/**
 * Search and filter component for test results
 */

import React, { ChangeEvent } from 'react';
import { colors, borderRadius, spacing } from '@/lib/theme';

interface SearchFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterStatus: 'all' | 'abnormal' | 'normal';
  onFilterChange: (filter: 'all' | 'abnormal' | 'normal') => void;
  resultCount: number;
  totalCount: number;
}

export function SearchFilter({
  searchQuery,
  onSearchChange,
  filterStatus,
  onFilterChange,
  resultCount,
  totalCount
}: SearchFilterProps) {
  return (
    <div style={{
      background: colors.white,
      border: `1px solid ${colors.primary[200]}`,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.xl,
      display: 'flex',
      gap: spacing.md,
      flexWrap: 'wrap',
      alignItems: 'center'
    }}>
      {/* Search Input */}
      <div style={{ flex: '1 1 300px' }}>
        <label htmlFor="test-search" style={{ 
          display: 'block',
          fontSize: 12,
          fontWeight: 600,
          color: colors.primary[600],
          marginBottom: spacing.xs
        }}>
          🔍 Search Tests
        </label>
        <input
          id="test-search"
          type="text"
          value={searchQuery}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
          placeholder="Search by test name..."
          style={{
            width: '100%',
            padding: `${spacing.sm} ${spacing.md}`,
            border: `2px solid ${colors.primary[200]}`,
            borderRadius: borderRadius.md,
            fontSize: 14,
            outline: 'none',
            transition: 'border-color 0.2s'
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = colors.info[500];
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = colors.primary[200];
          }}
          aria-label="Search test results"
        />
      </div>

      {/* Filter Buttons */}
      <div style={{ flex: '0 0 auto' }}>
        <div style={{ 
          fontSize: 12,
          fontWeight: 600,
          color: colors.primary[600],
          marginBottom: spacing.xs
        }}>
          Filter
        </div>
        <div style={{ display: 'flex', gap: spacing.xs }} role="group" aria-label="Filter test results">
          {(['all', 'abnormal', 'normal'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => onFilterChange(filter)}
              style={{
                padding: `${spacing.sm} ${spacing.md}`,
                border: `2px solid ${filterStatus === filter ? colors.info[500] : colors.primary[200]}`,
                borderRadius: borderRadius.md,
                background: filterStatus === filter ? colors.info[50] : colors.white,
                color: filterStatus === filter ? colors.info[700] : colors.primary[600],
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                textTransform: 'capitalize'
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = `3px solid ${colors.info[300]}`;
                e.currentTarget.style.outlineOffset = '2px';
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = 'none';
              }}
              aria-pressed={filterStatus === filter}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Result Count */}
      <div style={{ 
        flex: '0 0 auto',
        fontSize: 13,
        color: colors.primary[500],
        padding: spacing.md,
        background: colors.primary[50],
        borderRadius: borderRadius.md,
        fontWeight: 600
      }}
      role="status"
      aria-live="polite"
      >
        Showing {resultCount} of {totalCount} tests
      </div>
    </div>
  );
}
