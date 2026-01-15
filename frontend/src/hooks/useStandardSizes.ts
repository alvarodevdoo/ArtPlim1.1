/**
 * Hook for managing Standard Sizes
 * 
 * Provides functionality to fetch, cache, and manage standard sizes
 * filtered by ItemType with loading states and error handling.
 * 
 * Requirements: 3.2, 3.4
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ItemType } from '@/types/item-types';
import api from '@/lib/api';
import { useSmartCache, invalidateCache } from './useSmartCache';

export interface StandardSize {
    id: string;
    name: string;
    width: number;
    height: number;
    type: ItemType;
    companyId: string;
    createdAt: string;
    updatedAt: string;
}

export interface StandardSizeStats {
    totalByType: Record<ItemType, number>;
    mostUsedSizes: Array<{
        id: string;
        name: string;
        usageCount: number;
    }>;
}

interface UseStandardSizesOptions {
    autoLoad?: boolean;
    cacheTime?: number;
    onError?: (error: Error) => void;
    onSuccess?: (data: StandardSize[]) => void;
}

interface UseStandardSizesReturn {
    // Data
    sizes: StandardSize[];
    filteredSizes: StandardSize[];
    stats: StandardSizeStats | null;

    // State
    loading: boolean;
    error: Error | null;
    isStale: boolean;

    // Actions
    loadSizes: (type?: ItemType) => Promise<StandardSize[]>;
    loadSizesByType: (type: ItemType) => Promise<StandardSize[]>;
    loadStats: () => Promise<StandardSizeStats>;
    createSize: (data: Omit<StandardSize, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) => Promise<StandardSize>;
    updateSize: (id: string, data: Partial<StandardSize>) => Promise<StandardSize>;
    deleteSize: (id: string) => Promise<void>;
    createBatch: (sizes: Array<Omit<StandardSize, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>>) => Promise<StandardSize[]>;
    refresh: () => Promise<StandardSize[]>;
    invalidate: () => void;

    // Filtering
    filterByType: (type: ItemType) => StandardSize[];
    searchSizes: (query: string) => StandardSize[];
}

export const useStandardSizes = (
    type?: ItemType,
    options: UseStandardSizesOptions = {}
): UseStandardSizesReturn => {
    const {
        autoLoad = true,
        cacheTime = 5 * 60 * 1000, // 5 minutes
        onError,
        onSuccess
    } = options;

    // State for additional data
    const [stats, setStats] = useState<StandardSizeStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);

    // Cache key based on type filter
    const cacheKey = type ? `standard-sizes:type:${type}` : 'standard-sizes:all';

    // Main data fetching with smart cache
    const {
        data: sizes,
        loading,
        error,
        isStale,
        refresh: refreshCache,
        invalidate: invalidateCache
    } = useSmartCache<StandardSize[]>(
        cacheKey,
        async () => {
            const endpoint = type ? `/api/standard-sizes/by-type/${type}` : '/api/standard-sizes';
            const response = await api.get(endpoint);
            return response.data.data || response.data;
        },
        {
            ttl: cacheTime,
            staleWhileRevalidate: true,
            onError,
            onSuccess
        }
    );

    // Load sizes with optional type filter
    const loadSizes = useCallback(async (filterType?: ItemType): Promise<StandardSize[]> => {
        try {
            const endpoint = filterType ? `/api/standard-sizes/by-type/${filterType}` : '/api/standard-sizes';
            const response = await api.get(endpoint);
            const data = response.data.data || response.data;

            onSuccess?.(data);
            return data;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to load standard sizes');
            onError?.(error);
            throw error;
        }
    }, [onError, onSuccess]);

    // Load sizes by specific type
    const loadSizesByType = useCallback(async (itemType: ItemType): Promise<StandardSize[]> => {
        return loadSizes(itemType);
    }, [loadSizes]);

    // Load statistics
    const loadStats = useCallback(async (): Promise<StandardSizeStats> => {
        setStatsLoading(true);
        try {
            const response = await api.get('/api/standard-sizes/stats');
            const statsData = response.data.data || response.data;
            setStats(statsData);
            return statsData;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to load standard sizes stats');
            onError?.(error);
            throw error;
        } finally {
            setStatsLoading(false);
        }
    }, [onError]);

    // Create new standard size
    const createSize = useCallback(async (
        data: Omit<StandardSize, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>
    ): Promise<StandardSize> => {
        try {
            const response = await api.post('/api/standard-sizes', data);
            const newSize = response.data.data || response.data;

            // Invalidate cache to refresh data
            invalidateCache('standard-sizes:*');

            return newSize;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to create standard size');
            onError?.(error);
            throw error;
        }
    }, [onError]);

    // Update existing standard size
    const updateSize = useCallback(async (
        id: string,
        data: Partial<StandardSize>
    ): Promise<StandardSize> => {
        try {
            const response = await api.put(`/api/standard-sizes/${id}`, data);
            const updatedSize = response.data.data || response.data;

            // Invalidate cache to refresh data
            invalidateCache('standard-sizes:*');

            return updatedSize;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to update standard size');
            onError?.(error);
            throw error;
        }
    }, [onError]);

    // Delete standard size
    const deleteSize = useCallback(async (id: string): Promise<void> => {
        try {
            await api.delete(`/api/standard-sizes/${id}`);

            // Invalidate cache to refresh data
            invalidateCache('standard-sizes:*');
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to delete standard size');
            onError?.(error);
            throw error;
        }
    }, [onError]);

    // Create multiple sizes in batch
    const createBatch = useCallback(async (
        sizesData: Array<Omit<StandardSize, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>>
    ): Promise<StandardSize[]> => {
        try {
            const response = await api.post('/api/standard-sizes/batch', { sizes: sizesData });
            const newSizes = response.data.data || response.data;

            // Invalidate cache to refresh data
            invalidateCache('standard-sizes:*');

            return newSizes;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to create standard sizes in batch');
            onError?.(error);
            throw error;
        }
    }, [onError]);

    // Refresh data
    const refresh = useCallback(async (): Promise<StandardSize[]> => {
        const refreshedData = await refreshCache();
        return refreshedData || [];
    }, [refreshCache]);

    // Invalidate cache
    const invalidate = useCallback(() => {
        invalidateCache();
        invalidateCache('standard-sizes:*');
    }, [invalidateCache]);

    // Filter sizes by type
    const filterByType = useCallback((filterType: ItemType): StandardSize[] => {
        if (!sizes) return [];
        return sizes.filter(size => size.type === filterType);
    }, [sizes]);

    // Search sizes by name or dimensions
    const searchSizes = useCallback((query: string): StandardSize[] => {
        if (!sizes || !query.trim()) return sizes || [];

        const searchTerm = query.toLowerCase().trim();
        return sizes.filter(size =>
            size.name.toLowerCase().includes(searchTerm) ||
            `${size.width}x${size.height}`.includes(searchTerm) ||
            `${size.width} x ${size.height}`.includes(searchTerm)
        );
    }, [sizes]);

    // Memoized filtered sizes based on type prop
    const filteredSizes = useMemo(() => {
        if (!sizes) return [];
        if (!type) return sizes;
        return filterByType(type);
    }, [sizes, type, filterByType]);

    // Auto-load stats on mount if autoLoad is enabled
    useEffect(() => {
        if (autoLoad && !stats && !statsLoading) {
            loadStats().catch(() => {
                // Stats loading is optional, don't throw error
            });
        }
    }, [autoLoad, stats, statsLoading, loadStats]);

    return {
        // Data
        sizes: sizes || [],
        filteredSizes,
        stats,

        // State
        loading: loading || statsLoading,
        error,
        isStale,

        // Actions
        loadSizes,
        loadSizesByType,
        loadStats,
        createSize,
        updateSize,
        deleteSize,
        createBatch,
        refresh,
        invalidate,

        // Filtering
        filterByType,
        searchSizes
    };
};

// Utility hook for getting sizes by specific type (convenience wrapper)
export const useStandardSizesByType = (type: ItemType, options?: UseStandardSizesOptions) => {
    return useStandardSizes(type, options);
};

// Utility hook for size selection with auto-population
export const useStandardSizeSelection = (
    type: ItemType,
    onSizeSelect?: (size: StandardSize) => void
) => {
    const [selectedSize, setSelectedSize] = useState<StandardSize | null>(null);
    const { filteredSizes, loading, error } = useStandardSizes(type);

    const selectSize = useCallback((size: StandardSize | null) => {
        setSelectedSize(size);
        if (size && onSizeSelect) {
            onSizeSelect(size);
        }
    }, [onSizeSelect]);

    const selectSizeById = useCallback((id: string) => {
        const size = filteredSizes.find(s => s.id === id);
        selectSize(size || null);
    }, [filteredSizes, selectSize]);

    const clearSelection = useCallback(() => {
        setSelectedSize(null);
    }, []);

    return {
        sizes: filteredSizes,
        selectedSize,
        loading,
        error,
        selectSize,
        selectSizeById,
        clearSelection
    };
};

export default useStandardSizes;