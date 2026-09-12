// «Importar datos» de Mis pacientes (13-sep-2026).
//
// El médico sube un CSV o pega celdas de Excel con su lista (nombre, correo,
// teléfono, nota). Pasos: 1) archivo o pegado · 2) vista previa con las
// columnas detectadas y las filas con problemas marcadas · 3) revisión con
// useConfirmAction · 4) resultado de la base (creadas, repetidas, inválidas).
// Crear invitaciones NO envía correos ni crea cuentas: cada persona decide.
import React, { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle, CheckCircle2, ClipboardPaste, Download, Info, Loader2, Upload, XCircle,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useConfirmAction } from '@/components/common/ConfirmActionDialog';
import { fill } from '@/lib/proFormat';
import type { ImportSummary, InviteResult } from '@/hooks/usePatientInvites';
import {
  INVITE_MAX_FILE_BYTES,
  INVITE_MAX_ROWS,
  TEMPLATE_CSV,
  parsePatientText,
  readTextFile,
  type ParseResult,
  type ParsedPatientRow,
  type PatientRowInput,
} from './patientRows';
import { failureKey, isDuplicateReason, reasonKey } from './inviteMessages';
import '@/styles/funciones-importar.css';

type Mode = 'file' | 'paste';
type Step = 'input' | 'preview' | 'result';
type Filter = 'all' | 'problems';

interface ImportPatientsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Migración sin aplicar: se puede revisar la lista, no crear invitaciones. */
  pendingActivation: boolean;
  /** Acceso de pacientes abierto en Ajustes del sitio. */
  patientsAccessOpen: boolean;
  onImport: (rows: PatientRowInput[]) => Promise<InviteResult<ImportSummary>>;
  onShowInvites: () => void;
}

const PREVIEW_LIMIT = INVITE_MAX_ROWS;

export function ImportPatientsDialog({
  open, onOpenChange, pendingActivation, patientsAccessOpen, onImport, onShowInvites,
}: ImportPatientsDialogProps) {
  const { t } = useLanguage();
  const { confirm, dialog } = useConfirmAction();
  const fileInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>('file');
  const [step, setStep] = useState<Step>('input');
  const [filter, setFilter] = useState<Filter>('all');
  const [text, setText] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ summary: ImportSummary; sent: ParsedPatientRow[] } | null>(null);

  const reset = () => {
    setMode('file');
    setStep('input');
    setFilter('all');
    setText('');
    setSourceLabel('');
    setParsed(null);
    setInputError(null);
    setImporting(false);
    setResult(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && importing) return; // no se cierra a mitad de la escritura
    onOpenChange(next);
    if (!next) window.setTimeout(reset, 200);
  };

  const counts = useMemo(() => {
    const rows = parsed?.rows || [];
    const ready = rows.filter(r => !r.issue).length;
    const repeated = rows.filter(r => r.issue === 'repeated_in_file').length;
    return { total: rows.length, ready, repeated, invalid: rows.length - ready - repeated };
  }, [parsed]);

  const loadText = (raw: string, label: string) => {
    const res = parsePatientText(raw);
    if (res.rows.length === 0) {
      setInputError(t('mm2.importar.input.noRows'));
      return;
    }
    setInputError(null);
    setParsed(res);
    setSourceLabel(label);
    setFilter('all');
    setStep('preview');
  };

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    if (/\.(xlsx|xls|numbers|ods)$/i.test(file.name)) {
      setInputError(t('mm2.importar.input.spreadsheetFile'));
      return;
    }
    if (file.size > INVITE_MAX_FILE_BYTES) {
      setInputError(t('mm2.importar.input.fileTooBig'));
      return;
    }
    try {
      const raw = await readTextFile(file);
      loadText(raw, file.name);
    } catch (e) {
      console.error('[ImportPatients] lectura', e);
      setInputError(t('mm2.importar.input.readError'));
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob(['\uFEFF' + TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = t('mm2.importar.input.templateFile');
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const readyRows = useMemo(() => (parsed?.rows || []).filter(r => !r.issue), [parsed]);
  const canImport = !!parsed && !parsed.tooMany && readyRows.length > 0 && !pendingActivation && !importing;

  const runImport = async () => {
    if (!parsed || !canImport) return;
    const n = readyRows.length;
    const ok = await confirm({
      title: fill(t(n === 1 ? 'mm2.importar.confirm.titleOne' : 'mm2.importar.confirm.title'), { n }),
      description: t('mm2.importar.confirm.desc'),
      details: [
        { label: t('mm2.importar.confirm.source'), value: sourceLabel },
        { label: t('mm2.importar.confirm.ready'), value: String(n) },
        { label: t('mm2.importar.confirm.skipped'), value: String(counts.total - n) },
        { label: t('mm2.importar.confirm.emails'), value: t('mm2.importar.confirm.emailsValue') },
      ],
      confirmLabel: t('mm2.importar.confirm.confirm'),
    });
    if (!ok) return;
    setImporting(true);
    try {
      const res = await onImport(readyRows.map(({ full_name, email, phone, note }) => ({ full_name, email, phone, note })));
      if (res.ok === false) {
        toast.error(t(failureKey(res.reason)));
        return;
      }
      setResult({ summary: res.data, sent: readyRows });
      setStep('result');
    } finally {
      setImporting(false);
    }
  };

  const columnChip = (labelKey: string, idx: number, extra?: number[]) => {
    const indexes = [idx, ...(extra || [])].filter(i => i >= 0);
    const found = indexes.length > 0;
    const where = !found
      ? t('mm2.importar.preview.colMissing')
      : indexes
          .map(i => (parsed?.hasHeader ? `«${parsed.headers[i] || fill(t('mm2.importar.preview.colN'), { n: i + 1 })}»` : fill(t('mm2.importar.preview.colN'), { n: i + 1 })))
          .join(' + ');
    return (
      <span className={`fi-col ${found ? '' : 'is-missing'}`}>
        {found ? <CheckCircle2 /> : <XCircle />}
        {t(labelKey)}: {where}
      </span>
    );
  };

  const issuePill = (reason: string) => {
    const dup = isDuplicateReason(reason);
    return (
      <span className={`fi-issue ${dup ? 'is-dup' : 'is-bad'}`}>
        {dup ? <AlertTriangle /> : <XCircle />}
        {t(reasonKey(reason))}
      </span>
    );
  };

  const renderRow = (r: ParsedPatientRow, key: React.Key, reason?: string | null, lineLabel?: string) => {
    const issue = reason === undefined ? r.issue : reason;
    const tone = issue ? (isDuplicateReason(issue) ? 'is-dup' : 'is-bad') : '';
    return (
      <div key={key} className={`fi-row ${tone}`}>
        <span className="fi-line"><span className="fi-cell-label">{t('mm2.importar.preview.row')}</span>{lineLabel ?? r.line}</span>
        <span className="fi-name"><span className="fi-cell-label">{t('mm2.importar.col.name')}:</span>{r.full_name || <span className="fi-empty">—</span>}</span>
        <span><span className="fi-cell-label">{t('mm2.importar.col.email')}:</span>{r.email || <span className="fi-empty">—</span>}</span>
        <span><span className="fi-cell-label">{t('mm2.importar.col.phone')}:</span>{r.phone || <span className="fi-empty">—</span>}</span>
        <span><span className="fi-cell-label">{t('mm2.importar.col.note')}:</span>{r.note || <span className="fi-empty">—</span>}</span>
        {issue && <span className="fi-row-issue">{issuePill(issue)}</span>}
      </div>
    );
  };

  const header = (
    <div className="fi-row is-head" aria-hidden="true">
      <span>{t('mm2.importar.preview.row')}</span>
      <span>{t('mm2.importar.col.name')}</span>
      <span>{t('mm2.importar.col.email')}</span>
      <span>{t('mm2.importar.col.phone')}</span>
      <span>{t('mm2.importar.col.note')}</span>
    </div>
  );

  const activationNotices = (
    <>
      {pendingActivation && (
        <div className="fi-notice is-warn" role="status">
          <AlertTriangle />
          <span>{t('mm2.importar.pendingActivation')}</span>
        </div>
      )}
      {!patientsAccessOpen && (
        <div className="fi-notice" role="note">
          <Info />
          <span>{t('mm2.importar.patientsClosed')}</span>
        </div>
      )}
    </>
  );

  const visibleRows = (parsed?.rows || [])
    .filter(r => (filter === 'problems' ? !!r.issue : true))
    .slice(0, PREVIEW_LIMIT);
  const problems = counts.total - counts.ready;

  const notCreated = result
    ? result.summary.rows
        .filter(r => r.result !== 'created')
        .map(r => ({ info: r, row: result.sent[r.row - 1] }))
        .filter(x => !!x.row)
    : [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-white sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Upload className="w-5 h-5" /> {t('mm2.importar.title')}</DialogTitle>
          <DialogDescription>{t('mm2.importar.subtitle')}</DialogDescription>
        </DialogHeader>

        <div className="fi-dialog">
          {step === 'input' && (
            <>
              {activationNotices}
              <div className="pro-seg" aria-label={t('mm2.importar.input.modeLabel')}>
                <button type="button" aria-pressed={mode === 'file'} className={mode === 'file' ? 'is-active' : ''} onClick={() => { setMode('file'); setInputError(null); }}>
                  {t('mm2.importar.input.modeFile')}
                </button>
                <button type="button" aria-pressed={mode === 'paste'} className={mode === 'paste' ? 'is-active' : ''} onClick={() => { setMode('paste'); setInputError(null); }}>
                  {t('mm2.importar.input.modePaste')}
                </button>
              </div>

              {mode === 'file' ? (
                <>
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".csv,.tsv,.txt,text/csv,text/plain,text/tab-separated-values"
                    className="hidden"
                    aria-label={t('mm2.importar.input.chooseFile')}
                    onChange={e => handleFile(e.target.files?.[0])}
                  />
                  <button
                    type="button"
                    className={`fi-drop ${dragOver ? 'is-over' : ''}`}
                    onClick={() => fileInput.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
                  >
                    <span className="plus"><Upload /></span>
                    <b>{t('mm2.importar.input.chooseFile')}</b>
                    <span>{fill(t('mm2.importar.input.dropHint'), { max: INVITE_MAX_ROWS })}</span>
                  </button>
                </>
              ) : (
                <>
                  <textarea
                    className="fi-textarea"
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder={t('mm2.importar.input.pastePlaceholder')}
                    aria-label={t('mm2.importar.input.pasteLabel')}
                    spellCheck={false}
                  />
                  <div className="fi-foot">
                    <button type="button" className="pro-btn pro-btn-teal pro-btn-sm" disabled={!text.trim()} onClick={() => loadText(text, t('mm2.importar.confirm.sourcePaste'))}>
                      <ClipboardPaste /> {t('mm2.importar.input.review')}
                    </button>
                  </div>
                </>
              )}

              {inputError && (
                <div className="fi-notice is-warn" role="alert">
                  <AlertTriangle />
                  <span>{inputError}</span>
                </div>
              )}

              <div className="fi-help">
                <p>{fill(t('mm2.importar.input.columns'), { max: INVITE_MAX_ROWS })}</p>
                <p className="mt-1">{t('mm2.importar.input.excelHint')}</p>
                <p className="mt-1">{t('mm2.importar.input.privacy')}</p>
              </div>
              <div>
                <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={downloadTemplate}>
                  <Download /> {t('mm2.importar.input.template')}
                </button>
              </div>
            </>
          )}

          {step === 'preview' && parsed && (
            <>
              {activationNotices}
              <div className="fi-stats">
                <div className="fi-stat"><b>{counts.total}</b><span>{t('mm2.importar.preview.rows')}</span></div>
                <div className="fi-stat is-ok"><b>{counts.ready}</b><span>{t('mm2.importar.preview.ready')}</span></div>
                <div className="fi-stat is-warn"><b>{counts.repeated}</b><span>{t('mm2.importar.preview.repeated')}</span></div>
                <div className="fi-stat is-bad"><b>{counts.invalid}</b><span>{t('mm2.importar.preview.invalid')}</span></div>
              </div>

              <div>
                <p className="fi-help mb-1.5">
                  {parsed.hasHeader ? t('mm2.importar.preview.columnsByHeader') : t('mm2.importar.preview.columnsByContent')}
                </p>
                <div className="fi-cols">
                  {columnChip('mm2.importar.col.name', parsed.mapping.name, parsed.mapping.lastName)}
                  {columnChip('mm2.importar.col.email', parsed.mapping.email)}
                  {columnChip('mm2.importar.col.phone', parsed.mapping.phone)}
                  {columnChip('mm2.importar.col.note', parsed.mapping.note)}
                </div>
              </div>

              {parsed.tooMany && (
                <div className="fi-notice is-warn" role="alert">
                  <AlertTriangle />
                  <span>{fill(t('mm2.importar.preview.tooMany'), { n: counts.total, max: INVITE_MAX_ROWS })}</span>
                </div>
              )}
              {parsed.mapping.email < 0 && parsed.mapping.phone < 0 && (
                <div className="fi-notice is-warn" role="alert">
                  <AlertTriangle />
                  <span>{t('mm2.importar.preview.noContactColumn')}</span>
                </div>
              )}

              <div className="pro-seg" aria-label={t('mm2.importar.preview.filterLabel')}>
                <button type="button" aria-pressed={filter === 'all'} className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>
                  {fill(t('mm2.importar.preview.filterAll'), { n: counts.total })}
                </button>
                <button type="button" aria-pressed={filter === 'problems'} className={filter === 'problems' ? 'is-active' : ''} onClick={() => setFilter('problems')}>
                  {fill(t('mm2.importar.preview.filterProblems'), { n: problems })}
                </button>
              </div>

              <div className="fi-rows" role="list" aria-label={t('mm2.importar.preview.listLabel')}>
                {header}
                {visibleRows.length === 0 ? (
                  <p className="fi-help px-3 py-3">{t('mm2.importar.preview.noProblems')}</p>
                ) : (
                  visibleRows.map((r, i) => renderRow(r, `${r.line}-${i}`))
                )}
              </div>
              {counts.total > PREVIEW_LIMIT && filter === 'all' && (
                <p className="fi-help">{fill(t('mm2.importar.preview.showingFirst'), { n: PREVIEW_LIMIT })}</p>
              )}

              <div className="fi-foot">
                <span className="fi-foot-note">{t('mm2.importar.preview.noEmailsYet')}</span>
                <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" disabled={importing} onClick={() => setStep('input')}>
                  {t('mm2.importar.preview.back')}
                </button>
                <button type="button" className="pro-btn pro-btn-teal pro-btn-sm" disabled={!canImport} onClick={runImport}>
                  {importing ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                  {fill(t(readyRows.length === 1 ? 'mm2.importar.preview.createOne' : 'mm2.importar.preview.create'), { n: readyRows.length })}
                </button>
              </div>
            </>
          )}

          {step === 'result' && result && (
            <>
              <div className="fi-stats">
                <div className="fi-stat is-ok"><b>{result.summary.created}</b><span>{t('mm2.importar.result.created')}</span></div>
                <div className="fi-stat is-warn"><b>{result.summary.duplicates}</b><span>{t('mm2.importar.result.duplicates')}</span></div>
                <div className="fi-stat is-bad"><b>{result.summary.invalid}</b><span>{t('mm2.importar.result.invalid')}</span></div>
                <div className="fi-stat"><b>{counts.total - result.sent.length}</b><span>{t('mm2.importar.result.skippedInReview')}</span></div>
              </div>
              {result.summary.reactivated > 0 && (
                <p className="fi-help">{fill(t('mm2.importar.result.reactivated'), { n: result.summary.reactivated })}</p>
              )}
              {notCreated.length > 0 && (
                <div className="fi-rows" role="list" aria-label={t('mm2.importar.result.notCreatedLabel')}>
                  {header}
                  {notCreated.map(({ info, row }) => renderRow(row, `r-${info.row}`, info.reason || 'invalid'))}
                </div>
              )}
              <div className="fi-notice" role="status">
                <Info />
                <span>{result.summary.created > 0 ? t('mm2.importar.result.next') : t('mm2.importar.result.nothingCreated')}</span>
              </div>
              <div className="fi-foot">
                <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={reset}>
                  {t('mm2.importar.result.importAnother')}
                </button>
                <button
                  type="button"
                  className="pro-btn pro-btn-teal pro-btn-sm"
                  onClick={() => { onShowInvites(); handleOpenChange(false); }}
                >
                  {t('mm2.importar.result.viewInvites')}
                </button>
              </div>
            </>
          )}
        </div>
        {dialog}
      </DialogContent>
    </Dialog>
  );
}

export default ImportPatientsDialog;
