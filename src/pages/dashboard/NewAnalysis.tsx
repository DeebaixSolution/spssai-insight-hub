import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { StepProgress } from '@/components/spss-editor/StepProgress';
import { StepNavigation } from '@/components/spss-editor/StepNavigation';
import { Step1Upload } from '@/components/spss-editor/Step1Upload';
import { Step2Variables } from '@/components/spss-editor/Step2Variables';
import { Step3Research } from '@/components/spss-editor/Step3Research';
import { Step4Selection } from '@/components/spss-editor/Step4Selection';
import { Step5Results } from '@/components/spss-editor/Step5Results';
import { Step6Interpretation } from '@/components/spss-editor/Step6Interpretation';
import { Step7Export } from '@/components/spss-editor/Step7Export';
import { useAnalysisWizard } from '@/hooks/useAnalysisWizard';
import { useDataParser } from '@/hooks/useDataParser';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { UpgradePrompt } from '@/components/plan/UpgradePrompt';
import { toast } from 'sonner';

const steps = [
  { number: 1, title: 'Upload Data' },
  { number: 2, title: 'Variables' },
  { number: 3, title: 'Research' },
  { number: 4, title: 'Analysis' },
  { number: 5, title: 'Results' },
  { number: 6, title: 'Interpret' },
  { number: 7, title: 'Export' },
];

export default function NewAnalysis() {
  const navigate = useNavigate();
  const location = useLocation();
  const { detectVariableTypes } = useDataParser();
  const { canCreateAnalysis, getAnalysesRemaining } = usePlanLimits();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [suggestedTest, setSuggestedTest] = useState<{ category: string; type: string } | undefined>();
  const [isSaving, setIsSaving] = useState(false);

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

  const canProceed = () => {
    switch (state.currentStep) {
      case 1:
        return !!state.parsedData && !!state.projectName.trim();
      case 2:
        return state.variables.length > 0;
      case 3:
        return true; // Optional step
      case 4:
        return !!state.analysisConfig?.testType;
      case 5:
        return !!state.results;
      case 6:
        return !!state.aiInterpretation;
      case 7:
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
        
        // Auto-detect variable types
        const detectedVars = detectVariableTypes(state.parsedData);
        updateState({ variables: detectedVars });
      }

      // Step 4 -> 5: Save analysis config
      if (state.currentStep === 4 && state.analysisConfig) {
        await saveAnalysis({ analysisConfig: state.analysisConfig });
      }

      // Step 6 -> 7: Save interpretation
      if (state.currentStep === 6) {
        await saveAnalysis({
          aiInterpretation: state.aiInterpretation,
          apaResults: state.apaResults,
          discussion: state.discussion,
        });
      }

      nextStep();
    } catch (err) {
      console.error('Error proceeding:', err);
      toast.error('Failed to save. Please try again.');
    }
  };

  const handleFinish = async () => {
    try {
      await saveAnalysis({ currentStep: 7 });
      toast.success('Analysis saved successfully!');
      navigate('/dashboard/reports');
    } catch (err) {
      console.error('Error finishing:', err);
      toast.error('Failed to save analysis.');
    }
  };

  // Save progress without advancing to next step
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // If no project yet, create it first
      if (!state.projectId && state.parsedData && state.projectName.trim()) {
        const project = await createProject(state.projectName);
        await saveDataset({ projectId: project.id, parsedData: state.parsedData });
        
        // Auto-detect variable types if not already done
        if (state.variables.length === 0) {
          const detectedVars = detectVariableTypes(state.parsedData);
          updateState({ variables: detectedVars });
        }
      }

      // Save current analysis state
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
  }, [
    state,
    createProject,
    saveDataset,
    saveAnalysis,
    updateState,
    detectVariableTypes,
  ]);

  const isLoading = isCreatingProject || isSavingDataset || isSavingAnalysis;

  // Determine if save is possible
  const canSave = state.currentStep >= 1 && 
    Boolean(state.projectId || (state.parsedData && state.projectName.trim()));

  return (
    <div className="max-w-5xl mx-auto">
      {/* Step Progress */}
      <StepProgress
        steps={steps}
        currentStep={state.currentStep}
        onStepClick={goToStep}
      />

      {/* Step Content */}
      <div className="data-card">
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

        {state.currentStep === 4 && (
          <Step4Selection
            variables={state.variables}
            analysisConfig={state.analysisConfig}
            onConfigChange={(config) => updateState({ analysisConfig: config })}
            suggestedTest={suggestedTest}
          />
        )}

        {state.currentStep === 5 && (
          <Step5Results
            analysisConfig={state.analysisConfig}
            parsedData={state.parsedData}
            results={state.results}
            onResultsChange={(results) => updateState({ results })}
          />
        )}

        {state.currentStep === 6 && (
          <Step6Interpretation
            analysisConfig={state.analysisConfig}
            results={state.results}
            researchQuestion={state.researchQuestion}
            aiInterpretation={state.aiInterpretation}
            onAiInterpretationChange={(i) => updateState({ aiInterpretation: i })}
            apaResults={state.apaResults}
            onApaResultsChange={(a) => updateState({ apaResults: a })}
            discussion={state.discussion}
            onDiscussionChange={(d) => updateState({ discussion: d })}
          />
        )}

        {state.currentStep === 7 && (
          <Step7Export
            projectName={state.projectName}
            researchQuestion={state.researchQuestion}
            results={state.results}
            aiInterpretation={state.aiInterpretation}
            apaResults={state.apaResults}
            discussion={state.discussion}
          />
        )}

        {/* Navigation */}
        <StepNavigation
          currentStep={state.currentStep}
          totalSteps={7}
          onNext={handleNext}
          onPrevious={prevStep}
          canGoNext={canProceed()}
          isLoading={isLoading}
          showFinish={state.currentStep === 7}
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
