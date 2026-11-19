import { Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; exportError?: string }> {
  state: { failed: boolean; exportError?: string } = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  exportData = () => {
    try {
      const raw = localStorage.getItem('packmatrix:v1');
      if (!raw) throw new Error('No saved data found');
      const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url; link.download = 'packmatrix-recovery-backup.json'; link.click();
      URL.revokeObjectURL(url);
    } catch {
      this.setState({ exportError: 'Unable to read saved data from this device.' });
    }
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return <main><section className="card"><h1>PackMatrix needs to recover</h1><p>The app ran into an unexpected problem. You can export your saved data before refreshing.</p><button className="pri" onClick={this.exportData}>Export my data</button>{this.state.exportError && <p className="err">{this.state.exportError}</p>}</section></main>;
  }
}

createRoot(document.getElementById('root')!).render(<ErrorBoundary><App /></ErrorBoundary>);
