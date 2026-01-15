/**
 * Hook for managing Finishes by Type
 * 
 * Provides functionality to fetch, cache, and manage finishes
 * with type compatibility filtering and backward compatibility support.
 * 
 * Requirements: 5.2, 5.3, 5.5
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ItemType } from '@/types/item-types';
import api from '@/lib/api';
import { useSmartCache, invalidateCache } from './useSmartCache';

export interface Finish {
    id: string;
    name: string;
    description?: string;
    priceType: 'FIXED' | 'PER_UNIT' | 'PER_AREA' | 'PERCENTAGE';
    price: number;
    processingTimeMinutes?: number;
    allowedTypes: ItemType[];
    active: boolean;
    companyId: string;
    createdAt: string;
    updatedAt: string;
}

export interface FinishCompatibilityCheck {
    isCompatible: boolean;
    reason?: string;
    allowedTypes: ItemType[];
}

export interface FinishPriceCalculation {
    basePrice: number;
    finalPrice: number;
    priceType: string;
    area?: number;
    quantity?: number;
}

export interface FinishGroupedByPriceType {
    FIXED: Finish[];
    PER_UNIT: Finish[];
    PER_AREA: Finish[];
    PERCENTAGE: Finish[];
}

interface UseFinishesByTypeOptions {
    autoLoad?: boolean;
    cacheTime?: number;
    includeInactive?: boolean;
    onError?: (error: Error) => void;
    onSuccess?: (data: Finish[]) => void;
}

interface UseFinishesByTypeReturn {
    // Data
    finishes: Finish[];
    compatibleFinishes: Finish[];
    groupedByPriceType: FinishGroupedByPriceType;

    // State
    loading: boolean;
    error: Error | null;
    isStale: boolean;

    // Actions
    loadFinishes: (type?: ItemType) => Promise<Finish[]>;
    loadFinishesByType: (type: ItemType) => Promise<Finish[]>;
    loadFinishesWithProcessingTime: () => Promise<Finish[]>;
    createFinish: (data: Omit<Finish, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) => Promise<Finish>;
    updateFinish: (id: string, data: Partial<Finish>) => Promise<Finish>;
    deleteFinish: (id: string) => Promise<void>;
    refresh: () => Promise<Finish[]>;
    invalidate: () => void;

    // Compatibility and Calculations
    checkCompatibility: (finishId: string, type: ItemType) => Promise<FinishCompatibilityCheck>;
    calculatePrice: (finishId: string, params: { area?: number; quantity?: number; baseValue?: number }) => Promise<FinishPriceCalculation>;
    isFinishCompatible: (finish: Finish, type: ItemType) => boolean;

    // Filtering and Search
    filterByType: (type: ItemType) => Finish[];
    filterByPriceType: (priceType: Finish['priceType']) => Finish[];
    filterByActive: (active: boolean) => Finish[];
    searchFinishes: (query: string) => Finish[];
    getFinishesWithProcessingTime: () => Finish[];
}

export const useFinishesByType = (
    type?: ItemType,
    options: UseFinishesByTypeOptions = {}
): UseFinishesByTypeReturn => {
    const {
        autoLoad = true,
        cacheTime = 5 * 60 * 1000, // 5 minutes
        includeInactive = false,
        onError,
        onSuccess
    } = options;

    // State for additional data
    const [finishesWithProcessingTime, setFinishesWithProcessingTime] = useState<Finish[]>([]);

    // Cache key based on type filter and inactive inclusion
    const cacheKey = type
        ? `finishes:type:${type}:inactive:${includeInactive}`
        : `finishes:all:inactive:${includeInactive}`;

    // Main data fetching with smart cache
    const {
        data: finishes,
        loading,
        error,
        isStale,
        refresh: refreshCache,
        invalidate: invalidateCache
    } = useSmartCache<Finish[]>(
        cacheKey,
        async () => {
            const params = new URLSearchParams();
            if (type) params.append('type', type);
            if (includeInactive) params.append('includeInactive', 'true');

            const endpoint = type
                ? `/api/finishes/by-type/${type}?${params.toString()}`
                : `/api/finishes?${params.toString()}`;

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

    // Load finishes with optional type filter
    const loadFinishes = useCallback(async (filterType?: ItemType): Promise<Finish[]> => {
        try {
            const params = new URLSearchParams();
            if (filterType) params.append('type', filterType);
            if (includeInactive) params.append('includeInactive', 'true');

            const endpoint = filterType
                ? `/api/finishes/by-type/${filterType}?${params.toString()}`
                : `/api/finishes?${params.toString()}`;

            const response = await api.get(endpoint);
            const data = response.data.data || response.data;

            onSuccess?.(data);
            return data;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to load finishes');
            onError?.(error);
            throw error;
        }
    }, [includeInactive, onError, onSuccess]);

    // Load finishes by specific type
    const loadFinishesByType = useCallback(async (itemType: ItemType): Promise<Finish[]> => {
        return loadFinishes(itemType);
    }, [loadFinishes]);

    // Load finishes with processing time information
    const loadFinishesWithProcessingTime = useCallback(async (): Promise<Finish[]> => {
        try {
            const response = await api.get('/api/finishes/with-processing-time');
            const data = response.data.data || response.data;
            setFinishesWithProcessingTime(data);
            return data;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to load finishes with processing time');
            onError?.(error);
            throw error;
        }
    }, [onError]);

    // Create new finish
    const createFinish = useCallback(async (
        data: Omit<Finish, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>
    ): Promise<Finish> => {
        try {
            const response = await api.post('/api/finishes', data);
            const newFinish = response.data.data || response.data;

            // Invalidate cache to refresh data
            invalidateCache('finishes:*');

            return newFinish;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to create finish');
            onError?.(error);
            throw error;
        }
    }, [onError]);

    // Update existing finish
    const updateFinish = useCallback(async (
        id: string,
        data: Partial<Finish>
    ): Promise<Finish> => {
        try {
            const response = await api.put(`/api/finishes/${id}`, data);
            const updatedFinish = response.data.data || response.data;

            // Invalidate cache to refresh data
            invalidateCache('finishes:*');

            return updatedFinish;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to update finish');
            onError?.(error);
            throw error;
        }
    }, [onError]);

    // Delete finish
    const deleteFinish = useCallback(async (id: string): Promise<void> => {
        try {
            await api.delete(`/api/finishes/${id}`);

            // Invalidate cache to refresh data
            invalidateCache('finishes:*');
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to delete finish');
            onError?.(error);
            throw error;
        }
    }, [onError]);

    // Check compatibility between finish and item type
    const checkCompatibility = useCallback(async (
        finishId: string,
        itemType: ItemType
    ): Promise<FinishCompatibilityCheck> => {
        try {
            const response = await api.get(`/api/finishes/${finishId}/compatibility/${itemType}`);
            return response.data.data || response.data;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to check finish compatibility');
            onError?.(error);
            throw error;
        }
    }, [onError]);

    // Calculate finish price based on parameters
    const calculatePrice = useCallback(async (
        finishId: string,
        params: { area?: number; quantity?: number; baseValue?: number }
    ): Promise<FinishPriceCalculation> => {
        try {
            const response = await api.post(`/api/finishes/${finishId}/calculate-price`, params);
            return response.data.data || response.data;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to calculate finish price');
            onError?.(error);
            throw error;
        }
    }, [onError]);

    // Check if finish is compatible with item type (client-side)
    const isFinishCompatible = useCallback((finish: Finish, itemType: ItemType): boolean => {
        // If no allowedTypes specified, it's compatible with all types (backward compatibility)
        if (!finish.allowedTypes || finish.allowedTypes.length === 0) {
            return true;
        }

        // Check if the item type is in the allowed types
        return finish.allowedTypes.includes(itemType);
    }, []);

    // Refresh data
    const refresh = useCallback(async (): Promise<Finish[]> => {
        const refreshedData = await refreshCache();
        return refreshedData || [];
    }, [refreshCache]);

    // Invalidate cache
    const invalidate = useCallback(() => {
        invalidateCache();
        invalidateCache('finishes:*');
    }, [invalidateCache]);

    // Filter finishes by type (client-side compatibility check)
    const filterByType = useCallback((filterType: ItemType): Finish[] => {
        if (!finishes) return [];
        return finishes.filter(finish => isFinishCompatible(finish, filterType));
    }, [finishes, isFinishCompatible]);

    // Filter finishes by price type
    const filterByPriceType = useCallback((priceType: Finish['priceType']): Finish[] => {
        if (!finishes) return [];
        return finishes.filter(finish => finish.priceType === priceType);
    }, [finishes]);

    // Filter finishes by active status
    const filterByActive = useCallback((active: boolean): Finish[] => {
        if (!finishes) return [];
        return finishes.filter(finish => finish.active === active);
    }, [finishes]);

    // Search finishes by name or description
    const searchFinishes = useCallback((query: string): Finish[] => {
        if (!finishes || !query.trim()) return finishes || [];

        const searchTerm = query.toLowerCase().trim();
        return finishes.filter(finish =>
            finish.name.toLowerCase().includes(searchTerm) ||
            (finish.description && finish.description.toLowerCase().includes(searchTerm))
        );
    }, [finishes]);

    // Get finishes that have processing time defined
    const getFinishesWithProcessingTime = useCallback((): Finish[] => {
        if (!finishes) return [];
        return finishes.filter(finish =>
            finish.processingTimeMinutes !== undefined && finish.processingTimeMinutes > 0
        );
    }, [finishes]);

    // Memoized compatible finishes based on type prop
    const compatibleFinishes = useMemo(() => {
        if (!finishes) return [];
        if (!type) return finishes;
        return filterByType(type);
    }, [finishes, type, filterByType]);

    // Memoized finishes grouped by price type
    const groupedByPriceType = useMemo((): FinishGroupedByPriceType => {
        const grouped: FinishGroupedByPriceType = {
            FIXED: [],
            PER_UNIT: [],
            PER_AREA: [],
            PERCENTAGE: []
        };

        if (!finishes) return grouped;

        finishes.forEach(finish => {
            grouped[finish.priceType].push(finish);
        });

        return grouped;
    }, [finishes]);

    // Auto-load finishes with processing time on mount if autoLoad is enabled
    useEffect(() => {
        if (autoLoad && finishesWithProcessingTime.length === 0) {
            loadFinishesWithProcessingTime().catch(() => {
                // Processing time loading is optional, don't throw error
            });
        }
    }, [autoLoad, finishesWithProcessingTime.length, loadFinishesWithProcessingTime]);

    return {
        // Data
        finishes: finishes || [],
        compatibleFinishes,
        groupedByPriceType,

        // State
        loading,
        error,
        isStale,

        // Actions
        loadFinishes,
        loadFinishesByType,
        loadFinishesWithProcessingTime,
        createFinish,
        updateFinish,
        deleteFinish,
        refresh,
        invalidate,

        // Compatibility and Calculations
        checkCompatibility,
        calculatePrice,
        isFinishCompatible,

        // Filtering and Search
        filterByType,
        filterByPriceType,
        filterByActive,
        searchFinishes,
        getFinishesWithProcessingTime
    };
};

// Utility hook for getting finishes by specific type (convenience wrapper)
export const useFinishesForType = (type: ItemType, options?: UseFinishesByTypeOptions) => {
    return useFinishesByType(type, options);
};

// Utility hook for finish selection with compatibility checking
export const useFinishSelection = (
    type: ItemType,
    onFinishSelect?: (finish: Finish) => void
) => {
    const [selectedFinish, setSelectedFinish] = useState<Finish | null>(null);
    const [selectedFinishes, setSelectedFinishes] = useState<Finish[]>([]);
    const { compatibleFinishes, loading, error, isFinishCompatible } = useFinishesByType(type);

    const selectFinish = useCallback((finish: Finish | null) => {
        if (finish && !isFinishCompatible(finish, type)) {
            return false; // Cannot select incompatible finish
        }

        setSelectedFinish(finish);
        if (finish && onFinishSelect) {
            onFinishSelect(finish);
        }
        return true;
    }, [type, isFinishCompatible, onFinishSelect]);

    const selectFinishById = useCallback((id: string) => {
        const finish = compatibleFinishes.find(f => f.id === id);
        return selectFinish(finish || null);
    }, [compatibleFinishes, selectFinish]);

    const addFinish = useCallback((finish: Finish) => {
        if (!isFinishCompatible(finish, type)) {
            return false; // Cannot add incompatible finish
        }

        if (!selectedFinishes.find(f => f.id === finish.id)) {
            setSelectedFinishes(prev => [...prev, finish]);
        }
        return true;
    }, [type, isFinishCompatible, selectedFinishes]);

    const removeFinish = useCallback((finishId: string) => {
        setSelectedFinishes(prev => prev.filter(f => f.id !== finishId));
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedFinish(null);
        setSelectedFinishes([]);
    }, []);

    const clearSingleSelection = useCallback(() => {
        setSelectedFinish(null);
    }, []);

    const clearMultipleSelection = useCallback(() => {
        setSelectedFinishes([]);
    }, []);

    return {
        finishes: compatibleFinishes,
        selectedFinish,
        selectedFinishes,
        loading,
        error,
        selectFinish,
        selectFinishById,
        addFinish,
        removeFinish,
        clearSelection,
        clearSingleSelection,
        clearMultipleSelection,
        isCompatible: (finish: Finish) => isFinishCompatible(finish, type)
    };
};

export default useFinishesByType;