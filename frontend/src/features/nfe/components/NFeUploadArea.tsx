import React, { useRef } from 'react';
import { FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface NFeUploadAreaProps {
  isDragging: boolean;
  isLoading: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileProcess: (file: File) => void;
}

export const NFeUploadArea: React.FC<NFeUploadAreaProps> = ({
  isDragging,
  isLoading,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileProcess
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) onFileProcess(files[0]);
  };

  return (
    <Card className="border-dashed border-2 shadow-sm relative overflow-hidden group hover:border-primary/50 transition-colors">
      <CardContent className="p-6">
        <div
          className={`flex flex-col items-center justify-center p-4 rounded-2xl transition-all ${isDragging ? 'bg-primary/5 scale-[1.02]' : ''}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mb-3 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
            <FileText className="w-7 h-7" />
          </div>
          <h3 className="text-h2 text-slate-800 mb-1">Arraste e solte o XML</h3>
          <p className="text-body text-slate-500 mb-4 max-w-sm text-center">Nós cuidaremos da varredura dos itens, do fornecedor e impostos de forma automática.</p>

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".xml"
            onChange={handleFileChange}
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="h-10 px-6 shadow-xl hover:-translate-y-0.5 transition-all">
            {isLoading ? 'Processando XML...' : 'Buscar no Computador'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
