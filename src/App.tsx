import React, { useState, useEffect } from 'react';
import { Project, ReceiptImage, PlatformMetrics, ActivityLog, TrainingJob } from './types';
import { isSupabaseConfigured } from './lib/supabaseClient';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './components/LoginPage';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { UploadView } from './components/UploadView';
import { AnnotationWorkspace } from './components/AnnotationWorkspace';
import { ReviewQueue } from './components/ReviewQueue';
import { DatasetManager } from './components/DatasetManager';
import { TrainingStudio } from './components/TrainingStudio';
import { ApiDocsView } from './components/ApiDocsView';
import { TemplateManager } from './components/TemplateManager';
import { ProjectModal } from './components/ProjectModal';

function MainAppContent() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  // Core Data States
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [images, setImages] = useState<ReceiptImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<ReceiptImage | null>(null);
  
  // Dashboard & Training States
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [trainingJob, setTrainingJob] = useState<TrainingJob | null>(null);

  // Modal State
  const [isProjectModalOpen, setIsProjectModalOpen] = useState<boolean>(false);

  // Fetch initial backend data
  const fetchData = async () => {
    try {
      // 1. Fetch projects
      const projRes = await fetch('/api/projects');
      if (projRes.ok) {
        const projData: Project[] = await projRes.json();
        setProjects(projData);
        if (projData.length > 0 && !activeProject) {
          setActiveProject(projData[0]);
        }
      }

      // 2. Fetch images
      const imgRes = await fetch('/api/images');
      if (imgRes.ok) {
        const imgData: ReceiptImage[] = await imgRes.json();
        setImages(imgData);
        if (imgData.length > 0 && !selectedImage) {
          setSelectedImage(imgData[0]);
        }
      }

      // 3. Fetch metrics
      const metRes = await fetch('/api/metrics');
      if (metRes.ok) {
        const metData = await metRes.json();
        setMetrics(metData.metrics);
        setActivityLogs(metData.recentActivity || []);
      }
    } catch (err) {
      console.warn('Failed to fetch initial backend state:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center font-mono">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-xs uppercase tracking-widest text-slate-400">Loading Supabase Auth Session...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  // Filter images for active project
  const currentProjectImages = images.filter(
    img => !activeProject || img.projectId === activeProject.id
  );

  // Create Project Handler
  const handleCreateProject = async (name: string, description: string, receiptType: any) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, receiptType })
      });

      if (res.ok) {
        const newProj = await res.json();
        setProjects(prev => [newProj, ...prev]);
        setActiveProject(newProj);
        fetchData();
      }
    } catch (err) {
      console.error('Error creating project:', err);
    }
  };

  // Upload Receipt Success Handler
  const handleUploadSuccess = (newReceipt: ReceiptImage) => {
    setImages(prev => [newReceipt, ...prev]);
    setSelectedImage(newReceipt);
    setActiveTab('annotate');
    fetchData();
  };

  // Save Labels Handler
  const handleSaveLabels = async (imageId: string, fields: any[], status: 'approved' | 'needs_review' | 'rejected') => {
    try {
      const res = await fetch(`/api/images/${imageId}/labels`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields, status, reviewedBy: 'Senior AI Annotator' })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to update image status on server' }));
        throw new Error(errorData.error || 'Failed to update image status on server');
      }

      const updatedImg = await res.json();
      setImages(prev => prev.map(i => i.id === imageId ? updatedImg : i));
      setSelectedImage(updatedImg);
      fetchData();
    } catch (err) {
      console.error('Error saving labels:', err);
      throw err;
    }
  };

  // Run Instant Learning Training
  const handleRunTraining = async () => {
    if (!activeProject) return;

    setIsTraining(true);
    try {
      const res = await fetch('/api/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProject.id })
      });

      if (res.ok) {
        const data = await res.json();
        setTrainingJob(data.job);
        setActiveProject(data.project);
        fetchData();
      }
    } catch (err) {
      console.error('Training failed:', err);
    } finally {
      setIsTraining(false);
    }
  };

  // Dataset Export Handler
  const handleExportDataset = async (format: 'json' | 'csv' | 'excel') => {
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: activeProject?.id,
          format
        })
      });

      if (format === 'csv') {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Nanonets_ATM_Receipt_Dataset_${Date.now()}.csv`;
        a.click();
      } else {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Nanonets_ATM_Receipt_Dataset_${Date.now()}.json`;
        a.click();
      }
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  return (
    <div className={`min-h-screen flex font-sans transition-colors duration-200 ${
      isDarkMode ? 'bg-slate-950 text-slate-100 dark' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Enterprise Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        projects={projects}
        activeProject={activeProject}
        setActiveProject={setActiveProject}
        onOpenNewProjectModal={() => setIsProjectModalOpen(true)}
        pendingReviewsCount={currentProjectImages.filter(i => i.status === 'needs_review').length}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          projects={projects}
          activeProject={activeProject}
          setActiveProject={setActiveProject}
          onOpenNewProjectModal={() => setIsProjectModalOpen(true)}
          pendingReviewsCount={currentProjectImages.filter(i => i.status === 'needs_review').length}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          isSupabaseConfigured={isSupabaseConfigured()}
        />

        {/* Main View Container */}
        <main className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <Dashboard
              metrics={metrics}
              activityLogs={activityLogs}
              activeProject={activeProject}
              projects={projects}
              images={currentProjectImages}
              onNavigateTab={setActiveTab}
              onTrainModel={handleRunTraining}
              onOpenNewProjectModal={() => setIsProjectModalOpen(true)}
              isDarkMode={isDarkMode}
            />
          )}

          {activeTab === 'upload' && (
            <UploadView
              activeProject={activeProject}
              onUploadSuccess={handleUploadSuccess}
              isDarkMode={isDarkMode}
            />
          )}

          {activeTab === 'annotate' && (
            <AnnotationWorkspace
              images={currentProjectImages}
              selectedImage={selectedImage}
              setSelectedImage={setSelectedImage}
              onSaveLabels={handleSaveLabels}
              onTrainTrigger={handleRunTraining}
              isDarkMode={isDarkMode}
            />
          )}

          {activeTab === 'review-queue' && (
            <ReviewQueue
              images={currentProjectImages}
              onSelectForAnnotation={(img) => {
                setSelectedImage(img);
                setActiveTab('annotate');
              }}
              isDarkMode={isDarkMode}
            />
          )}

          {activeTab === 'dataset' && (
            <DatasetManager
              images={currentProjectImages}
              activeProject={activeProject}
              onExport={handleExportDataset}
              isDarkMode={isDarkMode}
            />
          )}

          {activeTab === 'templates' && (
            <TemplateManager />
          )}

          {activeTab === 'training' && (
            <TrainingStudio
              activeProject={activeProject}
              onRunTraining={handleRunTraining}
              isTraining={isTraining}
              trainingJob={trainingJob}
              isDarkMode={isDarkMode}
            />
          )}

          {activeTab === 'api-docs' && (
            <ApiDocsView isDarkMode={isDarkMode} />
          )}
        </main>
      </div>

      {/* New Project Modal */}
      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onCreateProject={handleCreateProject}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}

