import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayerNavigation } from '@/components/spss-editor/LayerNavigation';
import { StepProgress } from '@/components/spss-editor/StepProgress';
import { StepNavigation } from '@/components/spss-editor/StepNavigation';
import { StatisticalAnalysisCenter } from '@/components/spss-editor/StatisticalAnalysisCenter';
import { AcademicProductionLayer } from '@/components/spss-editor/AcademicProductionLayer';
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

// Layer 1 steps for the mini-progress within Research Design
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

  // Check if user can create analysis
  useEffect(() => {
    if (!canCreateAnalysis()) {
      setShowUpgrade(true);
    }
  }, [canCreateAnalysis]);

  // Load existing analysis if passed via router state
  useEffect(() => {
    const analysisId = (location.state as { analysisId?: string })?.analysisId;
    if (analysisId) {
      loadAnalysis(analysisId);
    }
  }, [location.state, loadAnalysis]);

  // Track completed steps
  const markStepCompleted = useCallback((step: number) => {
    setCompletedSteps(prev => new Set([...prev, step]));
  }, []);

  // Determine current layer
  const currentLayer = useMemo(() => {
    if (state.currentStep <= 3) return 1;
    if (state.currentStep <= 10) return 2;
    return 3;
  }, [state.currentStep]);

  const canProceed = () => {
    switch (state.currentStep) {
      case 1:
        return !!state.parsedData && !!state.projectName.trim();
      case 2:
        return state.variables.length > 0;
      case 3:
        return true; // Optional step
      case 4:
        return completedSteps.has(4);
      case 5: case 6: case 7: case 8: case 9: case 10:
        return true; // Optional tabs within Layer 2
      case 11: case 12:
        return true;
      case 13:
        return true;
      default:
        return false;
    }
  };

  const handleNext = async () => {
    try {
      // Step 1 -> 2: Create project and save dataset
      if (state.currentStep === 1 && state.parsedData) {
        const project = await createProject(state.projectName);
        await saveDataset({ projectId: project.id, parsedData: state.parsedData });
        const detectedVars = detectVariableTypes(state.parsedData);
        updateState({ variables: detectedVars });
        markStepCompleted(1);
      }

      // Mark current step completed on advance
      if (state.currentStep === 2 && state.variables.length > 0) {
        markStepCompleted(2);
      }
      if (state.currentStep === 3) {
        markStepCompleted(3);
      }

      // Step transitions within Layer 2
      if (state.currentStep >= 4 && state.currentStep <= 9) {
        markStepCompleted(state.currentStep);
      }

      // Save analysis config at key transitions
      if (state.currentStep === 10) {
        markStepCompleted(10);
      }

      if (state.currentStep === 12) {
        markStepCompleted(12);
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

  // Render step content based on current layer
  const renderStepContent = () => {
    // Layer 1: Research Design (Steps 1-3)
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

    // Layer 2: Statistical Analysis Center (Steps 4-10)
    if (currentLayer === 2) {
      return (
        <StatisticalAnalysisCenter
          currentStep={state.currentStep}
          completedSteps={completedSteps}
          onTabClick={goToStep}
        >
          {state.currentStep === 4 && (
            <Step4Descriptive
              variables={state.variables}
              parsedData={state.parsedData}
              onComplete={() => markStepCompleted(4)}
            />
          )}
          {state.currentStep === 5 && (
            <Step5Parametric variables={state.variables} parsedData={state.parsedData} />
          )}
          {state.currentStep === 6 && (
            <Step6NonParametric variables={state.variables} parsedData={state.parsedData} />
          )}
          {state.currentStep === 7 && (
            <Step7AnovaGLM variables={state.variables} parsedData={state.parsedData} />
          )}
          {state.currentStep === 8 && (
            <Step8Correlation variables={state.variables} parsedData={state.parsedData} />
          )}
          {state.currentStep === 9 && (
            <Step9Regression variables={state.variables} parsedData={state.parsedData} />
          )}
          {state.currentStep === 10 && (
            <Step10Measurement variables={state.variables} parsedData={state.parsedData} />
          )}
        </StatisticalAnalysisCenter>
      );
    }

    // Layer 3: Academic Production (Steps 11-13)
    return (
      <AcademicProductionLayer
        currentStep={state.currentStep}
        completedSteps={completedSteps}
        onSubStepClick={goToStep}
      >
        {state.currentStep === 11 && <Step11AcademicResults />}
        {state.currentStep === 12 && <Step12Theoretical />}
        {state.currentStep === 13 && <Step13ThesisBinder />}
      </AcademicProductionLayer>
    );
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* 3-Layer Navigation */}
      <LayerNavigation
        currentStep={state.currentStep}
        completedSteps={completedSteps}
        onLayerClick={goToStep}
      />

      {/* Layer 1: Show step progress within Research Design */}
      {currentLayer === 1 && (
        <StepProgress
          steps={layer1Steps}
          currentStep={state.currentStep}
          onStepClick={goToStep}
        />
      )}

      {/* Step Content */}
      <div className="data-card">
        {renderStepContent()}

        {/* Navigation */}
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

      {/* Upgrade Prompt */}
      <UpgradePrompt
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
        feature="more analyses"
      />
    </div>
  );
}
