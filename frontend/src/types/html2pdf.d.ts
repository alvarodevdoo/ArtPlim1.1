declare module 'html2pdf.js' {
  interface Html2PdfChain {
    set(options: any): Html2PdfChain;
    from(element: HTMLElement | string): Html2PdfChain;
    save(filename?: string): Promise<void>;
    output(type: string, options?: any): Promise<any>;
    toPdf(): Html2PdfChain;
    then(cb: (value: any) => any): Html2PdfChain;
  }
  function html2pdf(): Html2PdfChain;
  export default html2pdf;
}
