/**
 * Hook for managing Production Materials
 * 
 * Provides functionality to fetch, cache, and manage production materials
 * filtered by ItemType with advanced features like price management and batch operations.
 * 
 * Requirements: 4.2, 4.5
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ItemType } from '@/types/item-types';
import api from '@/lib/api';
import { useSmartCache, invalidateCache } from './useSmartCache';

export interface ProductionMaterial {
    id: string;
    name: string;
    type: ItemType;
    costPrice: number;
    salesPrice: number;
    properties: Record<string, any>;
    companyId: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface MaterialStats {
    totalByType: Record<ItemType, number>;
    averageCostByType: Record<ItemType, number>;
    averageSalesByType: Record<ItemType, number>;
    lowMarginMaterials: Array<{
        id: string;
        name: string;
        margin: number;
    }>;
}

export interface MaterialFilters {
    type?: ItemType;
    active?: boolean;
    minCostPrice?: number;
    maxCostPrice?: number;
    minSalesPrice?: number;
    maxSalesPrice?: number;
    search?: string;
}

interface UseProductionMaterialsOptions {
    autoLoad?: boolean;
    cacheTime?: number;
    onError?: (error: Error) => void;
    onSuccess?: (data: ProductionMaterial[]) => void;
}

interface UseProductionMaterialsReturn {
    // Data
    materials: ProductionMaterial[];
    filteredMaterials: ProductionMaterial[];
    stats: MaterialStats | null;

    // State
    loading: boolean;
    error: Error | null;
    isStale: boolean;

    // Actions
    loadMaterials: (filters?: MaterialFilters) => Promise<ProductionMaterial[]>;
    loadMaterialsByType: (type: ItemType) => Promise<ProductionMaterial[]>;
    loadStats: () => Promise<MaterialStats>;
    loadLowMarginMaterials: (threshold?: number) => Promise<ProductionMaterial[]>;
    createMaterial: (data: Omit<ProductionMaterial, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) => Promise<ProductionMaterial>;
    updateMaterial: (id: string, data: Partial<ProductionMaterial>) => Promise<ProductionMaterial>;
    deleteMaterial: (id: string) => Promise<void>;
    createBatch: (materials: Array<Omit<ProductionMaterial, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>>) => Promise<ProductionMaterial[]>;
    updatePricesInBatch: (updates: Array<{ id: string; costPrice?: number; salesPrice?: number }>) => Promise<ProductionMaterial[]>;
    refresh: () => Promise<ProductionMaterial[]>;
    invalidate: () => void;

    // Filtering and Search
    filterByType: (type: ItemType) => ProductionMaterial[];
    filterByActive: (active: boolean) => ProductionMaterial[];
    filterByPriceRange: (minCost?: number, maxCost?: number, minSales?: number, maxSales?: number) => ProductionMaterial[];
    searchMaterials: (query: string) => ProductionMaterial[];
    applyFilters: (filters: MaterialFilters) => ProductionMaterial[];

    // Utility functions
    calculateMargin: (material: ProductionMaterial) => number;
    getMaterialsByProperty: (property: string, value: any) => ProductionMaterial[];
    getUniquePropertyValues: (property: string) => any[];
}

export const useProductionMaterials = (
    type?: ItemType,
    options: UseProductionMaterialsOptions = {}
): UseProductionMaterialsReturn => {
    const {
        autoLoad = true,
        cacheTime = 5 * 60 * 1000, // 5 minutes
        onError,
        onSuccess
    } = options;

    // State for additional data
    const [stats, setStats] = useState<MaterialStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [lowMarginMaterials, setLowMarginMaterials] = useState<ProductionMaterial[]>([]);

    // Cache key based on type filter
    const cacheKey = type ? `production-materials:type:${type}` : 'production-materials:all';

    // Main data fetching with smart cache
    const {
        data: materials,
        loading,
        error,
        isStale,
        refresh: refreshCache,
        invalidate: invalidateCache
    } = useSmartCache<ProductionMaterial[]>(
        cacheKey,
        async () => {
            const endpoint = type ? `/api/production-materials/by-type/${type}` : '/api/production-materials';
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

    // Load materials with optional filters
    const loadMaterials = useCallback(async (filters?: MaterialFilters): Promise<ProductionMaterial[]> => {
        try {
            const params = new URLSearchParams();

            if (filters?.type) params.append('type', filters.type);
            if (filters?.active !== undefined) params.append('active', filters.active.toString());
            if (filters?.minCostPrice) params.append('minCostPrice', filters.minCostPrice.toString());
            if (filters?.maxCostPrice) params.append('maxCostPrice', filters.maxCostPrice.toString());
            if (filters?.minSalesPrice) params.append('minSalesPrice', filters.minSalesPrice.toString());
            if (filters?.maxSalesPrice) params.append('maxSalesPrice', filters.maxSalesPrice.toString());
            if (filters?.search) params.append('search', filters.search);

            const endpoint = `/api/production-materials?${params.toString()}`;
            const response = await api.get(endpoint);
            const data = response.data.data || response.data;

            onSuccess?.(data);
            return data;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to load production materials');
            onError?.(error);
            throw error;
        }
    }, [onError, onSuccess]);

    // Load materials by specific type
    const loadMaterialsByType = useCallback(async (itemType: ItemType): Promise<ProductionMaterial[]> => {
        return loadMaterials({ type: itemType });
    }, [loadMaterials]);

    // Load statistics
    const loadStats = useCallback(async (): Promise<MaterialStats> => {
        setStatsLoading(true);
        try {
            const response = await api.get('/api/production-materials/stats');
            const statsData = response.data.data || response.data;
            setStats(statsData);
            return statsData;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to load production materials stats');
            onError?.(error);
            throw error;
        } finally {
            setStatsLoading(false);
        }
    }, [onError]);

    // Load low margin materials
    const loadLowMarginMaterials = useCallback(async (threshold = 20): Promise<ProductionMaterial[]> => {
        try {
            const response = await api.get(`/api/production-materials/low-margin?threshold=${threshold}`);
            const data = response.data.data || response.data;
            setLowMarginMaterials(data);
            return data;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to load low margin materials');
            onError?.(error);
            throw error;
        }
    }, [onError]);

    // Create new production material
    const createMaterial = useCallback(async (
        data: Omit<ProductionMaterial, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>
    ): Promise<ProductionMaterial> => {
        try {
            const response = await api.post('/api/production-materials', data);
            const newMaterial = response.data.data || response.data;

            // Invalidate cache to refresh data
            invalidateCache('production-materials:*');

            return newMaterial;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to create production material');
            onError?.(error);
            throw error;
        }
    }, [onError]);

    // Update existing production material
    const updateMaterial = useCallback(async (
        id: string,
        data: Partial<ProductionMaterial>
    ): Promise<ProductionMaterial> => {
        try {
            const response = await api.put(`/api/production-materials/${id}`, data);
            const updatedMaterial = response.data.data || response.data;

            // Invalidate cache to refresh data
            invalidateCache('production-materials:*');

            return updatedMaterial;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to update production material');
            onError?.(error);
            throw error;
        }
    }, [onError]);

    // Delete production material
    const deleteMaterial = useCallback(async (id: string): Promise<void> => {
        try {
            await api.delete(`/api/production-materials/${id}`);

            // Invalidate cache to refresh data
            invalidateCache('production-materials:*');
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to delete production material');
            onError?.(error);
            throw error;
        }
    }, [onError]);

    // Create multiple materials in batch
    const createBatch = useCallback(async (
        materialsData: Array<Omit<ProductionMaterial, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>>
    ): Promise<ProductionMaterial[]> => {
        try {
            const response = await api.post('/api/production-materials/batch', { materials: materialsData });
            const newMaterials = response.data.data || response.data;

            // Invalidate cache to refresh data
            invalidateCache('production-materials:*');

            return newMaterials;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to create production materials in batch');
            onError?.(error);
            throw error;
        }
    }, [onError]);

    // Update prices in batch
    const updatePricesInBatch = useCallback(async (
        updates: Array<{ id: string; costPrice?: number; salesPrice?: number }>
    ): Promise<ProductionMaterial[]> => {
        try {
            const response = await api.put('/api/production-materials/batch-price-update', { updates });
            const updatedMaterials = response.data.data || response.data;

            // Invalidate cache to refresh data
            invalidateCache('production-materials:*');

            return updatedMaterials;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to update prices in batch');
            onError?.(error);
            throw error;
        }
    }, [onError]);

    // Refresh data
    const refresh = useCallback(async (): Promise<ProductionMaterial[]> => {
        const refreshedData = await refreshCache();
        return refreshedData || [];
    }, [refreshCache]);

    // Invalidate cache
    const invalidate = useCallback(() => {
        invalidateCache();
        invalidateCache('production-materials:*');
    }, [invalidateCache]);

    // Filter materials by type
    const filterByType = useCallback((filterType: ItemType): ProductionMaterial[] => {
        if (!materials) return [];
        return materials.filter(material => material.type === filterType);
    }, [materials]);

    // Filter materials by active status
    const filterByActive = useCallback((active: boolean): ProductionMaterial[] => {
        if (!materials) return [];
        return materials.filter(material => material.active === active);
    }, [materials]);

    // Filter materials by price range
    const filterByPriceRange = useCallback((
        minCost?: number,
        maxCost?: number,
        minSales?: number,
        maxSales?: number
    ): ProductionMaterial[] => {
        if (!materials) return [];

        return materials.filter(material => {
            if (minCost !== undefined && material.costPrice < minCost) return false;
            if (maxCost !== undefined && material.costPrice > maxCost) return false;
            if (minSales !== undefined && material.salesPrice < minSales) return false;
            if (maxSales !== undefined && material.salesPrice > maxSales) return false;
            return true;
        });
    }, [materials]);

    // Search materials by name or properties
    const searchMaterials = useCallback((query: string): ProductionMaterial[] => {
        if (!materials || !query.trim()) return materials || [];

        const searchTerm = query.toLowerCase().trim();
        return materials.filter(material =>
            material.name.toLowerCase().includes(searchTerm) ||
            JSON.stringify(material.properties).toLowerCase().includes(searchTerm)
        );
    }, [materials]);

    // Apply multiple filters
    const applyFilters = useCallback((filters: MaterialFilters): ProductionMaterial[] => {
        if (!materials) return [];

        let filtered = materials;

        if (filters.type) {
            filtered = filtered.filter(m => m.type === filters.type);
        }

        if (filters.active !== undefined) {
            filtered = filtered.filter(m => m.active === filters.active);
        }

        if (filters.minCostPrice !== undefined) {
            filtered = filtered.filter(m => m.costPrice >= filters.minCostPrice!);
        }

        if (filters.maxCostPrice !== undefined) {
            filtered = filtered.filter(m => m.costPrice <= filters.maxCostPrice!);
        }

        if (filters.minSalesPrice !== undefined) {
            filtered = filtered.filter(m => m.salesPrice >= filters.minSalesPrice!);
        }

        if (filters.maxSalesPrice !== undefined) {
            filtered = filtered.filter(m => m.salesPrice <= filters.maxSalesPrice!);
        }

        if (filters.search) {
            const searchTerm = filters.search.toLowerCase().trim();
            filtered = filtered.filter(m =>
                m.name.toLowerCase().includes(searchTerm) ||
                JSON.stringify(m.properties).toLowerCase().includes(searchTerm)
            );
        }

        return filtered;
    }, [materials]);

    // Calculate margin percentage
    const calculateMargin = useCallback((material: ProductionMaterial): number => {
        if (material.salesPrice === 0) return 0;
        return ((material.salesPrice - material.costPrice) / material.salesPrice) * 100;
    }, []);

    // Get materials by specific property value
    const getMaterialsByProperty = useCallback((property: string, value: any): ProductionMaterial[] => {
        if (!materials) return [];
        return materials.filter(material =>
            material.properties && material.properties[property] === value
        );
    }, [materials]);

    // Get unique values for a specific property
    const getUniquePropertyValues = useCallback((property: string): any[] => {
        if (!materials) return [];

        const values = materials
            .filter(material => material.properties && material.properties[property] !== undefined)
            .map(material => material.properties[property]);

        return Array.from(new Set(values));
    }, [materials]);

    // Memoized filtered materials based on type prop
    const filteredMaterials = useMemo(() => {
        if (!materials) return [];
        if (!type) return materials;
        return filterByType(type);
    }, [materials, type, filterByType]);

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
        materials: materials || [],
        filteredMaterials,
        stats,

        // State
        loading: loading || statsLoading,
        error,
        isStale,

        // Actions
        loadMaterials,
        loadMaterialsByType,
        loadStats,
        loadLowMarginMaterials,
        createMaterial,
        updateMaterial,
        deleteMaterial,
        createBatch,
        updatePricesInBatch,
        refresh,
        invalidate,

        // Filtering and Search
        filterByType,
        filterByActive,
        filterByPriceRange,
        searchMaterials,
        applyFilters,

        // Utility functions
        calculateMargin,
        getMaterialsByProperty,
        getUniquePropertyValues
    };
};

// Utility hook for getting materials by specific type (convenience wrapper)
export const useProductionMaterialsByType = (type: ItemType, options?: UseProductionMaterialsOptions) => {
    return useProductionMaterials(type, options);
};

// Utility hook for material selection with price information
export const useProductionMaterialSelection = (
    type: ItemType,
    onMaterialSelect?: (material: ProductionMaterial) => void
) => {
    const [selectedMaterial, setSelectedMaterial] = useState<ProductionMaterial | null>(null);
    const { filteredMaterials, loading, error, calculateMargin } = useProductionMaterials(type);

    const selectMaterial = useCallback((material: ProductionMaterial | null) => {
        setSelectedMaterial(material);
        if (material && onMaterialSelect) {
            onMaterialSelect(material);
        }
    }, [onMaterialSelect]);

    const selectMaterialById = useCallback((id: string) => {
        const material = filteredMaterials.find(m => m.id === id);
        selectMaterial(material || null);
    }, [filteredMaterials, selectMaterial]);

    const clearSelection = useCallback(() => {
        setSelectedMaterial(null);
    }, []);

    const selectedMaterialMargin = useMemo(() => {
        return selectedMaterial ? calculateMargin(selectedMaterial) : 0;
    }, [selectedMaterial, calculateMargin]);

    return {
        materials: filteredMaterials,
        selectedMaterial,
        selectedMaterialMargin,
        loading,
        error,
        selectMaterial,
        selectMaterialById,
        clearSelection
    };
};

export default useProductionMaterials;