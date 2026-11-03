import { adminApi } from '../api'
import {
  Button,
  LoadState,
  PageHeader,
  Panel,
  UploadButton,
  formatBytes,
  formatDate,
  useAction,
  useLoad,
} from '../ui'
import ProfileTabs from './ProfileTabs'

export default function ResumePage() {
  const state = useLoad(() => adminApi.resume())
  const [run, busy] = useAction()
  const active = state.data?.active

  const activate = async (mediaId, message) => {
    const result = await run(() => adminApi.setResume(mediaId), message)
    if (result.ok) state.reload()
  }

  return (
    <>
      <PageHeader
        crumb="Studio / Profile & content"
        title="Resume"
        description="Upload a PDF and choose which version visitors download from the hero."
        actions={
          <UploadButton
            kind="document"
            label="Upload new PDF"
            onUploaded={(media) =>
              activate(media.id, `${media.filename} is now your public resume`)
            }
          />
        }
      />
      <ProfileTabs />
      <LoadState state={state}>
        <Panel title="Active public version">
          {active ? (
            <div className="studio-resume-active">
              <span className="studio-doc-icon">PDF</span>
              <div>
                <strong>{active.filename}</strong>
                <span className="studio-muted">
                  {formatBytes(active.size_bytes)} · uploaded {formatDate(active.created_at)}
                </span>
              </div>
              <a className="studio-btn small" href={active.url} target="_blank" rel="noreferrer">
                Preview ↗
              </a>
              <a className="studio-btn small" href={active.url} download>
                Download
              </a>
              <Button
                size="small"
                variant="ghost"
                busy={busy}
                onClick={() => activate(null, 'Public resume removed')}
              >
                Unpublish
              </Button>
            </div>
          ) : (
            <p className="studio-alert">
              No resume is selected, so the site serves the original bundled{' '}
              <code>/Resume.pdf</code>. Upload a PDF to replace it.
            </p>
          )}
          {active && (
            <iframe
              className="studio-pdf-preview"
              src={active.url}
              title={`Preview of ${active.filename}`}
            />
          )}
        </Panel>
        <Panel
          title="All PDF versions"
          description="Older versions stay in the media library until you delete them."
        >
          {state.data?.versions.length === 0 ? (
            <p className="studio-empty">No PDFs uploaded yet.</p>
          ) : (
            <ul className="studio-list">
              {state.data?.versions.map((doc) => (
                <li key={doc.id} className="studio-collection-row">
                  <span className="studio-doc-icon small">PDF</span>
                  <div>
                    <strong>{doc.filename}</strong>
                    <span className="studio-muted">
                      {formatBytes(doc.size_bytes)} · {formatDate(doc.created_at)}
                    </span>
                  </div>
                  {active?.id === doc.id ? (
                    <span className="studio-pill published">Active</span>
                  ) : (
                    <Button
                      size="small"
                      busy={busy}
                      onClick={() => activate(doc.id, `${doc.filename} is now active`)}
                    >
                      Make active
                    </Button>
                  )}
                  <a
                    className="studio-btn small ghost"
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open ↗
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </LoadState>
    </>
  )
}
