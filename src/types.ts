export interface ComponentInstance {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  props: Record<string, any>;
  resizeMode?: 'scale' | 'fixed';
}

export interface DragEvent {
  id: string;
  x: number;
  y: number;
}
