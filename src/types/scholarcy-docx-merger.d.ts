declare module '@scholarcy/docx-merger' {
  export default class DocxMerger {
    constructor();
    initialize(options: any, files: string[]): Promise<void>;
    save(type: 'nodebuffer' | 'blob' | 'base64'): Promise<any>;
  }
}
