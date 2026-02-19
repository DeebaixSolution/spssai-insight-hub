import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayerNavigation } from '@/components/spss-editor/LayerNavigation';
import { StepProgress } from '@/components/spss-editor/StepProgress';
import { StepNavigation } from '@/components/spss-editor/StepNavigation';
import { StatisticalAnalysisCenter } from '@/components/spss-editor/StatisticalAnalysisCenter';
import { AcademicProductionLayer } from '@/components/spss-editor/AcademicProductionLayer';
import { AIAssistantPanel } from '@/components/spss-editor/AIAssistantPanel';
import { Step1Upload } from '@/components/spss-editor/Step1Upload';
import { Step2Variables } from '@/components/spss-editor/Step2Variables';
import { Step3Research } from '@/components/spss-editor/Step3Research';
import { Step4Descriptive } from '@/components/spss-editor/Step4Descriptive';
import { Step5Parametric } from '@/components/spss-editor/Step5Parametric';
import { Step6NonParametric } from '@/components/spss-editor/Step6NonParametric';
import { Step7AnovaGLM } from '@/components/spss-editor/Step7AnovaGLM';
import { Step8Correlation } from '@/components/spss-editor/Step8Correlation';
import { Step9Regression } from '@/components/spss-editor/Step9Regression';
import { Step10Measurement } from '@/components/spss-editor/Step10Measurement';
import { Step11AcademicResults } from '@/components/spss-editor/Step11AcademicResults';
import { Step12Theoretical } from '@/components/spss-editor/Step12Theoretical';
import { Step13ThesisBinder } from '@/components/spss-editor/Step13ThesisBinder';
import { useAnalysisWizard } from '@/hooks/useAnalysisWizard';
import { useDataParser } from '@/hooks/useDataParser';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { UpgradePrompt } from '@/components/plan/UpgradePrompt';
import { toast } from 'sonner';

const layer1Steps = [
  { number: 1, title: 'Upload Data' },
  { number: 2, title: 'Variables' },
  { number: 3, title: 'Research' },
];

export default function NewAnalysis() {
  const navigate = useNavigate();
  const location = useLocation();
  const { detectVariableTypes } = useDataParser();
  const { canCreateAnalysis } = usePlanLimits();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [suggestedTest, setSuggestedTest] = useState<{ category: string; type: string } | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  const {
    state,
    updateState,
    goToStep,
    nextStep,
    prevStep,
    createProject,
    saveDataset,
    saveAnalysis,
    loadAnalysis,
    isCreatingProject,
    isSavingDataset,
    isSavingAnalysis,
  } = useAnalysisWizard();

  useEffect(() => {
    if (!canCreateAnalysis()) {
      setShowUpgrade(true);
    }
  }, [canCreateAnalysis]);

  useEffect(() => {
    const analysisId = (location.state as { analysisId?: string })?.analysisId;
    if (analysisId) {
      loadAnalysis(analysisId);
    }
  }, [location.state, loadAnalysis]);

  // Derive completedSteps from loaded currentStep so progress persists across sessions
  useEffect(() => {
    if (state.analysisId && state.currentStep > 1) {
      const completed = new Set<number>();
      for (let i = 1; i < state.currentStep; i++) completed.add(i);
      setCompletedSteps(completed);
    }
  }, [state.analysisId]);

  // Wire navigate-to-step custom event from child components (e.g., Step 13 "Go to Step 12" button)
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const step = e.detail?.step;
      if (typeof step === 'number') goToStep(step);
    };
    window.addEventListener('navigate-to-step', handler as EventListener);
    return () => window.removeEventListener('navigate-to-step', handler as EventListener);
  }, [goToStep]);

  // Auto-save every 60 seconds
  useEffect(() => {
    if (!state.projectId || !state.datasetId) return;

    autoSaveTimer.current = setInterval(async () => {
      try {
        await saveAnalysis({
          currentStep: state.currentStep,
          researchQuestion: state.researchQuestion,
          hypothesis: state.hypothesis,
          analysisConfig: state.analysisConfig,
          results: state.results,
          aiInterpretation: state.aiInterpretation,
          apaResults: state.apaResults,
          discussion: state.discussion,
        });
        console.log('Auto-saved at', new Date().toLocaleTimeString());
      } catch (err) {
        console.error('Auto-save failed:', err);
      }
    }, 60000);

    return () => {
      if (autoSaveTimer.current) clearInterval(autoSaveTimer.current);
    };
  }, [state.projectId, state.datasetId, state.currentStep]);

  const markStepCompleted = useCallback((step: number) => {
    setCompletedSteps(prev => new Set([...prev, step]));
  }, []);

  const currentLayer = useMemo(() => {
    if (state.currentStep <= 3) return 1;
    if (state.currentStep <= 10) return 2;
    return 3;
  }, [state.currentStep]);

  const canProceed = () => {
    switch (state.currentStep) {
      case 1: return !!state.parsedData && !!state.projectName.trim();
      case 2: return state.variables.length > 0;
      case 3: return true;
      case 4: return completedSteps.has(4);
      case 5: case 6: case 7: case 8: case 9: case 10: return true;
      case 11: case 12: case 13: return true;
      default: return false;
    }
  };

  const handleNext = async () => {
    try {
      if (state.currentStep === 1 && state.parsedData) {
        const project = await createProject(state.projectName);
        await saveDataset({ projectId: project.id, parsedData: state.parsedData });
        const detectedVars = detectVariableTypes(state.parsedData);
        updateState({ variables: detectedVars });
        markStepCompleted(1);
      }

      if (state.currentStep === 2 && state.variables.length > 0) markStepCompleted(2);
      if (state.currentStep === 3) markStepCompleted(3);
      if (state.currentStep >= 4 && state.currentStep <= 10) markStepCompleted(state.currentStep);
      if (state.currentStep === 12) markStepCompleted(12);

      // Auto-save on step transitions
      if (state.projectId && state.datasetId) {
        try {
          await saveAnalysis({
            currentStep: state.currentStep + 1,
            researchQuestion: state.researchQuestion,
            hypothesis: state.hypothesis,
            analysisConfig: state.analysisConfig,
            results: state.results,
            aiInterpretation: state.aiInterpretation,
            apaResults: state.apaResults,
            discussion: state.discussion,
          });
        } catch (err) {
          console.error('Auto-save on transition failed:', err);
        }
      }

      nextStep();
    } catch (err) {
      console.error('Error proceeding:', err);
      toast.error('Failed to save. Please try again.');
    }
  };

  const handleFinish = async () => {
    try {
      await saveAnalysis({ currentStep: 13 });
      markStepCompleted(13);
      toast.success('Analysis saved successfully!');
      navigate('/dashboard/reports');
    } catch (err) {
      console.error('Error finishing:', err);
      toast.error('Failed to save analysis.');
    }
  };

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      if (!state.projectId && state.parsedData && state.projectName.trim()) {
        const project = await createProject(state.projectName);
        await saveDataset({ projectId: project.id, parsedData: state.parsedData });
        if (state.variables.length === 0) {
          const detectedVars = detectVariableTypes(state.parsedData);
          updateState({ variables: detectedVars });
        }
      }

      if (state.projectId && state.datasetId) {
        await saveAnalysis({
          currentStep: state.currentStep,
          researchQuestion: state.researchQuestion,
          hypothesis: state.hypothesis,
          analysisConfig: state.analysisConfig,
          results: state.results,
          aiInterpretation: state.aiInterpretation,
          apaResults: state.apaResults,
          discussion: state.discussion,
        });
      }

      toast.success('Progress saved!');
    } catch (err) {
      console.error('Error saving progress:', err);
      toast.error('Failed to save progress.');
    } finally {
      setIsSaving(false);
    }
  }, [state, createProject, saveDataset, saveAnalysis, updateState, detectVariableTypes]);

  const isLoading = isCreatingProject || isSavingDataset || isSavingAnalysis;
  const canSave = state.currentStep >= 1 &&
    Boolean(state.projectId || (state.parsedData && state.projectName.trim()));

  const renderStepContent = () => {
    if (currentLayer === 1) {
      return (
        <>
          {state.currentStep === 1 && (
            <Step1Upload
              onDataParsed={(data) => updateState({ parsedData: data })}
              parsedData={state.parsedData}
              projectName={state.projectName}
              onProjectNameChange={(name) => updateState({ projectName: name })}
            />
          )}
          {state.currentStep === 2 && (
            <Step2Variables
              variables={state.variables}
              onVariablesChange={(vars) => updateState({ variables: vars })}
              parsedData={state.parsedData}
            />
          )}
          {state.currentStep === 3 && (
            <Step3Research
              researchQuestion={state.researchQuestion}
              onResearchQuestionChange={(q) => updateState({ researchQuestion: q })}
              variables={state.variables}
              hypotheses={state.hypotheses}
              onHypothesesChange={(hypotheses) => updateState({ hypotheses })}
              hypothesis={state.hypothesis}
              onHypothesisChange={(h) => updateState({ hypothesis: h })}
              onSuggestedTest={(cat, type) => setSuggestedTest({ category: cat, type })}
            />
          )}
        </>
      );
    }

    if (currentLayer === 2) {
      return (
        <StatisticalAnalysisCenter
          currentStep={state.currentStep}
          completedSteps={completedSteps}
          onTabClick={goToStep}
          analysisId={state.analysisId}
          variables={state.variables}
          hypotheses={state.hypotheses}
          parsedData={state.parsedData}
        >
          {state.currentStep === 4 && (
            <Step4Descriptive variables={state.variables} parsedData={state.parsedData} analysisId={state.analysisId} onComplete={() => markStepCompleted(4)} />
          )}
          {state.currentStep === 5 && (
            <Step5Parametric variables={state.variables} parsedData={state.parsedData} analysisId={state.analysisId} hypotheses={state.hypotheses} />
          )}
          {state.currentStep === 6 && (
            <Step6NonParametric variables={state.variables} parsedData={state.parsedData} analysisId={state.analysisId} hypotheses={state.hypotheses} />
          )}
          {state.currentStep === 7 && (
            <Step7AnovaGLM variables={state.variables} parsedData={state.parsedData} analysisId={state.analysisId} hypotheses={state.hypotheses} />
          )}
          {state.currentStep === 8 && (
            <Step8Correlation variables={state.variables} parsedData={state.parsedData} analysisId={state.analysisId} hypotheses={state.hypotheses} />
          )}
          {state.currentStep === 9 && (
            <Step9Regression variables={state.variables} parsedData={state.parsedData} analysisId={state.analysisId} hypotheses={state.hypotheses} />
          )}
          {state.currentStep === 10 && (
            <Step10Measurement variables={state.variables} parsedData={state.parsedData} analysisId={state.analysisId} />
          )}
        </StatisticalAnalysisCenter>
      );
    }

    return (
      <AcademicProductionLayer
        currentStep={state.currentStep}
        completedSteps={completedSteps}
        onSubStepClick={goToStep}
      >
        {state.currentStep === 11 && <Step11AcademicResults analysisId={state.analysisId} projectId={state.projectId} />}
        {state.currentStep === 12 && <Step12Theoretical analysisId={state.analysisId} />}
        {state.currentStep === 13 && <Step13ThesisBinder analysisId={state.analysisId} />}
      </AcademicProductionLayer>
    );
  };

  return (
    <div className="max-w-6xl mx-auto">
      <LayerNavigation currentStep={state.currentStep} completedSteps={completedSteps} onLayerClick={goToStep} />

      {currentLayer === 1 && (
        <StepProgress steps={layer1Steps} currentStep={state.currentStep} onStepClick={goToStep} />
      )}

      {/* AI Assistant Panel */}
      <AIAssistantPanel currentStep={state.currentStep} />

      <div className="data-card">
        {renderStepContent()}

        <StepNavigation
          currentStep={state.currentStep}
          totalSteps={13}
          onNext={handleNext}
          onPrevious={prevStep}
          canGoNext={canProceed()}
          isLoading={isLoading}
          showFinish={state.currentStep === 13}
          onFinish={handleFinish}
          onSave={handleSave}
          isSaving={isSaving}
          canSave={canSave}
        />
      </div>

      <UpgradePrompt open={showUpgrade} onOpenChange={setShowUpgrade} feature="more analyses" />
    </div>
  );
}
