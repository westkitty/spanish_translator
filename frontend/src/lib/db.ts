// IndexedDB-backed project store. Full project records and lightweight library
// metadata are stored separately so opening the library never loads audio blobs.

import type { CaptionWord } from '../components/CaptionEditor';
import type { Translation } from '../hooks/useTranscriber';

export interface StoredProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  model: string;
  duration