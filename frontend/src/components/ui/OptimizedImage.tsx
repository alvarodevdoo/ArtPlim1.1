import React, { useState, useRef, useEffect } from 'react';
import { useLazyImage } from '../../hooks/useLazyLoad';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  placeholder?: string;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png' | 'auto';
  sizes?: string;
  priority?: boolean;
  onLoad?: () => void;
  onError?: () => void;
  fallback?: string;
}

// Função para gerar URL otimizada (simulação - em produção usaria um serviço como Cloudinary)
const generateOptimizedUrl = (
  src: string,
  width?: number,
  height?: number,
  quality = 80,
  format = 'auto'
): string => {
  // Em produção, isso seria integrado com um serviço de otimização de imagens
  const params = new URLSearchParams();
  
  if (width) params.set('w', width.toString());
  if (height) params.set('h', height.toString());
  if (quality !== 80) params.set('q', quality.toString());
  if (format !== 'auto') params.set('f', format);
  
  const queryString = params.toString();
  return queryString ? `${src}?${queryString}` : src;
};

// Função para gerar srcSet responsivo
const generateSrcSet = (src: string, width?: number, quality = 80, format = 'auto'): string => {
  if (!width) return '';
  
  const breakpoints = [0.5, 1, 1.5, 2]; // 50%, 100%, 150%, 200%
  
  return breakpoints
    .map(multiplier => {
      const scaledWidth = Math.round(width * multiplier);
      const optimizedUrl = generateOptimizedUrl(src, scaledWidth, undefined, quality, format);
      return `${optimizedUrl} ${multiplier}x`;
    })
    .join(', ');
};

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  className = '',
  placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkNhcnJlZ2FuZG8uLi48L3RleHQ+PC9zdmc+',
  quality = 80,
  format = 'auto',
  sizes,
  priority = false,
  onLoad,
  onError,
  fallback
}) => {
  const [imageError, setImageError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Usar lazy loading se não for prioridade
  const { imgRef: lazyRef, imageSrc, isLoaded: lazyLoaded, isError: lazyError } = useLazyImage(
    priority ? src : generateOptimizedUrl(src, width, height, quality, format),
    placeholder
  );

  // Combinar refs
  useEffect(() => {
    if (imgRef.current && lazyRef.current !== imgRef.current) {
      lazyRef.current = imgRef.current;
    }
  }, [lazyRef]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setImageError(true);
    onError?.();
  };

  // Se houver erro e tiver fallback, usar fallback
  const finalSrc = (imageError || lazyError) && fallback 
    ? fallback 
    : priority 
      ? generateOptimizedUrl(src, width, height, quality, format)
      : imageSrc;

  const srcSet = generateSrcSet(src, width, quality, format);

  // Detectar suporte a WebP
  const [supportsWebP, setSupportsWebP] = useState<boolean | null>(null);

  useEffect(() => {
    const checkWebPSupport = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const dataURL = canvas.toDataURL('image/webp');
      setSupportsWebP(dataURL.indexOf('data:image/webp') === 0);
    };

    checkWebPSupport();
  }, []);

  // Ajustar formato baseado no suporte do browser
  const finalFormat = format === 'auto' 
    ? (supportsWebP ? 'webp' : 'jpeg')
    : format;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Placeholder enquanto carrega */}
      {!isLoaded && !lazyLoaded && (
        <div 
          className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center"
          style={{ width, height }}
        >
          <svg 
            className="w-8 h-8 text-gray-400" 
            fill="currentColor" 
            viewBox="0 0 20 20"
          >
            <path 
              fillRule="evenodd" 
              d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" 
              clipRule="evenodd" 
            />
          </svg>
        </div>
      )}

      {/* Imagem principal */}
      <img
        ref={imgRef}
        src={finalSrc}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        width={width}
        height={height}
        onLoad={handleLoad}
        onError={handleError}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className={`
          transition-opacity duration-300
          ${isLoaded || lazyLoaded ? 'opacity-100' : 'opacity-0'}
          ${imageError || lazyError ? 'opacity-50' : ''}
        `}
        style={{
          maxWidth: '100%',
          height: 'auto',
          ...(width && height ? { aspectRatio: `${width}/${height}` } : {})
        }}
      />

      {/* Indicador de erro */}
      {(imageError || lazyError) && !fallback && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <svg className="w-8 h-8 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-sm">Erro ao carregar imagem</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Componente para galeria de imagens otimizadas
interface ImageGalleryProps {
  images: Array<{
    src: string;
    alt: string;
    caption?: string;
  }>;
  className?: string;
  itemClassName?: string;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png' | 'auto';
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  className = '',
  itemClassName = '',
  quality = 80,
  format = 'auto'
}) => {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);

  return (
    <>
      <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 ${className}`}>
        {images.map((image, index) => (
          <div 
            key={index}
            className={`cursor-pointer hover:opacity-80 transition-opacity ${itemClassName}`}
            onClick={() => setSelectedImage(index)}
          >
            <OptimizedImage
              src={image.src}
              alt={image.alt}
              width={300}
              height={200}
              quality={quality}
              format={format}
              className="w-full h-48 object-cover rounded-lg"
            />
            {image.caption && (
              <p className="mt-2 text-sm text-gray-600 text-center">
                {image.caption}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Modal de visualização */}
      {selectedImage !== null && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="max-w-4xl max-h-full">
            <OptimizedImage
              src={images[selectedImage].src}
              alt={images[selectedImage].alt}
              quality={90}
              format={format}
              priority
              className="max-w-full max-h-full object-contain"
            />
            {images[selectedImage].caption && (
              <p className="text-white text-center mt-4">
                {images[selectedImage].caption}
              </p>
            )}
          </div>
          
          {/* Botões de navegação */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImage(prev => 
                    prev === null ? null : prev > 0 ? prev - 1 : images.length - 1
                  );
                }}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 text-4xl"
              >
                ‹
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImage(prev => 
                    prev === null ? null : prev < images.length - 1 ? prev + 1 : 0
                  );
                }}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 text-4xl"
              >
                ›
              </button>
            </>
          )}
          
          {/* Botão de fechar */}
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 text-2xl"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
};

// Hook para pré-carregar imagens
export const useImagePreloader = (urls: string[]) => {
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const preloadImages = React.useCallback(async () => {
    setLoading(true);
    
    const promises = urls.map(url => {
      return new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(url);
        img.onerror = () => reject(new Error(`Failed to load ${url}`));
        img.src = url;
      });
    });

    try {
      const loaded = await Promise.allSettled(promises);
      const successful = loaded
        .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
        .map(result => result.value);
      
      setLoadedImages(new Set(successful));
    } catch (error) {
      console.error('Error preloading images:', error);
    } finally {
      setLoading(false);
    }
  }, [urls]);

  React.useEffect(() => {
    if (urls.length > 0) {
      preloadImages();
    }
  }, [urls, preloadImages]);

  return {
    loadedImages,
    loading,
    preloadImages
  };
};