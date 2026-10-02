/**
 * UI management and event handling
 */

class UIManager {
  constructor() {
    this.selectedQuestions = [];
    this.showAnswers = false;
    this.customTitle = "Choose your course below";
    this.questionColumns = 1;
    this.questionSpacing = 20;
    this.pxToPtRatio = 0.75;
    this.graphCanvasWidthPx = 420;
    this.graphCanvasHeightPx = 240;
    this.graphCanvasVerticalMarginPx = 15;
    this.currentLoadedQuestions = [];
    this.addAllButtonTop = null;
    this.legacyGraphWarningIds = new Set();
    this.invalidGraphSchemaWarningIds = new Set();
    this.bindEvents();
  }

  /**
   * Bind all UI events
   */
  bindEvents() {
    // Course selection
    document.getElementById("courseSelect").addEventListener("change", () => {
      this.updateCourseButtons();
      this.onCourseChange();
    });

    document.getElementById("courseList").addEventListener("click", (event) => {
      const button = event.target.closest("[data-course-value]");
      if (!button) return;

      const courseSelect = document.getElementById("courseSelect");
      courseSelect.value = button.dataset.courseValue;
      this.onCourseChange();
    });

    // Objective selection
    document.getElementById("objectiveSelect").addEventListener("change", () => {
      this.clearQuestionList();
    });

    // Button events
    document.getElementById("loadQuestions").addEventListener("click", () => {
      this.loadQuestions();
    });

    // Add All button (top menu)
    this.addAllButtonTop = document.getElementById("addAllQuestionsTop");
    this.addAllButtonTop.addEventListener("click", () => {
      this.addAllQuestions(this.currentLoadedQuestions);
    });

    document.getElementById("clearSelection").addEventListener("click", () => {
      this.clearPreview();
    });

    document.getElementById("generateAssignment").addEventListener("click", () => {
      this.generateAssignment();
    });

    document.getElementById("editButton").addEventListener("click", () => {
      this.editAssignment();
    });

    document.getElementById("savePdfButton").addEventListener("click", () => {
      this.savePdf();
    });

    // Custom title input
    document.getElementById("customTitle").addEventListener("input", (e) => {
      this.customTitle = e.target.value || "Choose your course below";
      this.updateDisplayedTitle();
    });

    // Layout controls
    document.querySelectorAll('input[name="questionColumns"]').forEach(radio => {
      radio.addEventListener("change", (e) => {
        this.questionColumns = parseInt(e.target.value);
      });
    });

    document.getElementById("questionSpacing").addEventListener("input", (e) => {
      // Convert px input to pt for print consistency (1px ≈ 0.75pt)
      this.questionSpacing = Math.round(parseInt(e.target.value, 10) * this.pxToPtRatio);
    });
  }

  convertPixelsToPoints(pixels) {
    const value = Number(pixels);
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * this.pxToPtRatio * 100) / 100;
  }

  /**
   * Handle course selection change
   */
  onCourseChange() {
    this.updateCourseButtons();
    const course = document.getElementById("courseSelect").value;
    this.buildChapterCheckboxes(course);
    this.populateObjectives();
    this.populateDifficultyOptions();
    this.clearQuestionList();
  }

  /**
   * Populate course dropdown
   */
  populateCourses() {
    const courseSelect = document.getElementById("courseSelect");
    const courseList = document.getElementById("courseList");
    courseSelect.innerHTML = "";
    courseList.innerHTML = "";

    const courses = window.QuestionGenerator.getCourses();
    const preferredCourseOrder = ["Algebra 1", "Geometry", "Consumer Math"];
    const orderedCourses = [...courses].sort((left, right) => {
      const leftIndex = preferredCourseOrder.indexOf(left);
      const rightIndex = preferredCourseOrder.indexOf(right);
      return (leftIndex < 0 ? preferredCourseOrder.length : leftIndex) -
        (rightIndex < 0 ? preferredCourseOrder.length : rightIndex);
    });
    
    if (courses.length === 0) {
      courseList.innerHTML = "<span class='muted'>No courses available</span>";
      return;
    }

    // Add default option
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "(select course)";
    courseSelect.appendChild(defaultOption);

    // Add course options
    orderedCourses.forEach(course => {
      const option = document.createElement("option");
      option.value = course;
      option.textContent = course;
      courseSelect.appendChild(option);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "course-option";
      button.dataset.courseValue = course;
      button.textContent = course.startsWith("Algebra") ? "Algebra" : course;
      button.setAttribute("aria-pressed", "false");
      courseList.appendChild(button);
    });

    // Auto-select first course
    if (orderedCourses.length > 0) {
      courseSelect.value = orderedCourses[0];
      this.onCourseChange();
    }
  }

  updateCourseButtons() {
    const selectedCourse = document.getElementById("courseSelect").value;
    document.querySelectorAll("#courseList [data-course-value]").forEach(button => {
      const isSelected = button.dataset.courseValue === selectedCourse;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-pressed", String(isSelected));
    });
  }

  /**
   * Build chapter checkboxes
   */
  buildChapterCheckboxes(course) {
    const container = document.getElementById("chapterContainer");
    container.innerHTML = "";

    if (!course) {
      container.innerHTML = "<div class='muted'>Select a course first</div>";
      return;
    }

    const chapters = window.QuestionGenerator.getChapters(course);
    
    if (chapters.length === 0) {
      container.innerHTML = "<div class='muted'>No chapters available</div>";
      return;
    }

    chapters.forEach(chapter => {
      const label = document.createElement("label");
      label.className = "chapter-checkbox";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = chapter;
      checkbox.checked = false;
      checkbox.addEventListener("change", () => {
        this.populateObjectives();
        this.populateDifficultyOptions();
        this.clearQuestionList();
      });

      const span = document.createElement("span");
      span.textContent = chapter;

      label.appendChild(checkbox);
      label.appendChild(span);
      container.appendChild(label);
    });
  }

  /**
   * Get selected chapters
   */
  getSelectedChapters() {
    return Array.from(document.querySelectorAll("#chapterContainer input[type=checkbox]:checked"))
      .map(cb => cb.value);
  }

  /**
   * Populate objectives dropdown
   */
  populateObjectives() {
    const objectiveSelect = document.getElementById("objectiveSelect");
    objectiveSelect.innerHTML = "";

    const course = document.getElementById("courseSelect").value;
    const chapters = this.getSelectedChapters();

    if (!course || chapters.length === 0) {
      objectiveSelect.innerHTML = "<option value=''>(select course & chapters)</option>";
      return;
    }

    const questions = window.QuestionGenerator.getQuestionsFromChapters(course, chapters);
    const objectives = window.QuestionGenerator.getObjectives(questions);

    // Add default option
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "(any objective)";
    objectiveSelect.appendChild(defaultOption);

    // Add objective options
    objectives.forEach(objective => {
      const option = document.createElement("option");
      option.value = objective;
      option.textContent = objective;
      objectiveSelect.appendChild(option);
    });
  }

  /**
   * Populate difficulty dropdown
   */
  populateDifficultyOptions() {
    const difficultySelect = document.getElementById("difficultySelect");
    difficultySelect.innerHTML = "";

    const course = document.getElementById("courseSelect").value;
    const chapters = this.getSelectedChapters();
    const objective = document.getElementById("objectiveSelect").value;

    if (!course || chapters.length === 0) {
      difficultySelect.innerHTML = "<option value=''>(any)</option>";
      return;
    }

    let questions = window.QuestionGenerator.getQuestionsFromChapters(course, chapters);
    
    if (objective) {
      questions = questions.filter(q => q.objective === objective);
    }

    const difficulties = window.QuestionGenerator.getDifficulties(questions);

    // Add default option
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "(any)";
    difficultySelect.appendChild(defaultOption);

    // Add difficulty options
    difficulties.forEach(difficulty => {
      const option = document.createElement("option");
      option.value = difficulty;
      option.textContent = difficulty;
      difficultySelect.appendChild(option);
    });
  }

  /**
   * Load and display filtered questions
   */
  loadQuestions() {
    const course = document.getElementById("courseSelect").value;
    const chapters = this.getSelectedChapters();
    const objective = document.getElementById("objectiveSelect").value;
    const difficulty = document.getElementById("difficultySelect").value;

    const questionList = document.getElementById("questionList");
    questionList.innerHTML = "";

    if (!course || chapters.length === 0) {
      questionList.innerHTML = "<div class='muted'>Select a course and at least one chapter.</div>";
      return;
    }

    // Get questions
    let questions = window.QuestionGenerator.getQuestionsFromChapters(course, chapters);
    
    // Apply filters
    questions = window.QuestionGenerator.filterQuestions(questions, { objective, difficulty });

    // Store current loaded questions for the Add All button
    this.currentLoadedQuestions = questions;

    if (questions.length === 0) {
      questionList.innerHTML = "<div class='muted'>No questions match the current filters.</div>";
      this.addAllButtonTop.classList.add("hidden");
      return;
    }

    // Update and show the Add All button in top menu
    this.addAllButtonTop.textContent = `Add All ${questions.length} Questions`;
    this.addAllButtonTop.classList.remove("hidden");

    // Display questions
    questions.forEach(question => {
      const questionItem = this.createQuestionItem(question);
      questionList.appendChild(questionItem);
    });
  }

  /**
   * Create a question item element
   */
  createQuestionItem(question) {
    const item = document.createElement("div");
    item.className = "question-item";

    const info = document.createElement("div");
    
    const difficultyClass = `difficulty-${question.difficulty || 'basic'}`;
    
    info.innerHTML = `
      <div class="objective-header">${question.id || 'Unknown ID'}</div>
      <div class="muted">
        ${question.objective || 'No objective'} • 
        <span class="difficulty-badge ${difficultyClass}">${question.difficulty || 'basic'}</span>
      </div>
      <div style="margin-top: 8px;">${question.question || 'No question text'}</div>
    `;

    const controls = document.createElement("div");
    const addButton = document.createElement("button");
    addButton.textContent = "Add";
    addButton.className = "small";
    addButton.addEventListener("click", () => {
      this.addQuestionToPreview(question);
    });

    controls.appendChild(addButton);
    item.appendChild(info);
    item.appendChild(controls);

    return item;
  }

  /**
   * Add question to preview
   */
  addQuestionToPreview(question) {
    // Create a deep copy
    const copy = JSON.parse(JSON.stringify(question));
    this.selectedQuestions.push(copy);
    this.renderPreview();
  }

  /**
   * Add all questions to preview
   */
  addAllQuestions(questions) {
    questions.forEach(question => {
      const copy = JSON.parse(JSON.stringify(question));
      this.selectedQuestions.push(copy);
    });
    this.renderPreview();
  }

  /**
   * Clear preview
   */
  clearPreview() {
    this.selectedQuestions = [];
    this.renderPreview();
  }

  /**
   * Render preview section
   */
  renderPreview() {
    const preview = document.getElementById("assignmentPreview");
    preview.innerHTML = "";

    if (this.selectedQuestions.length === 0) {
      preview.innerHTML = "<div class='muted'>No questions selected yet. Use 'Add' button on questions to build your assignment.</div>";
      return;
    }

    // Make preview container sortable
    preview.style.position = "relative";

    this.selectedQuestions.forEach((question, index) => {
      const previewItem = this.createPreviewItem(question, index);
      preview.appendChild(previewItem);
    });

    // Initialize drag and drop functionality
    this.initializeDragAndDrop();
  }

  /**
   * Create preview item element
   */
  createPreviewItem(question, index) {
    const item = document.createElement("div");
    item.className = "preview-item draggable";
    item.draggable = true;
    item.dataset.index = index;

    const info = document.createElement("div");
    const difficultyClass = `difficulty-${question.difficulty || 'basic'}`;
    
    // Add drag handle
    const dragHandle = document.createElement("div");
    dragHandle.className = "drag-handle";
    dragHandle.innerHTML = "⋮⋮";
    dragHandle.style.cssText = `
      cursor: grab;
      color: #95a5a6;
      font-size: 16px;
      font-weight: bold;
      margin-right: 10px;
      user-select: none;
      line-height: 1;
    `;
    
    info.innerHTML = `
      <div><strong>${index + 1}. ${question.id || 'Unknown ID'}</strong></div>
      <div class="muted">
        ${question.objective || 'No objective'} • 
        <span class="difficulty-badge ${difficultyClass}">${question.difficulty || 'basic'}</span>
      </div>
    `;

    const leftSection = document.createElement("div");
    leftSection.style.display = "flex";
    leftSection.style.alignItems = "center";
    leftSection.appendChild(dragHandle);
    leftSection.appendChild(info);

    const controls = document.createElement("div");
    
    const duplicateBtn = document.createElement("button");
    duplicateBtn.textContent = "Duplicate";
    duplicateBtn.className = "small";
    duplicateBtn.addEventListener("click", () => {
      const copy = JSON.parse(JSON.stringify(question));
      this.selectedQuestions.splice(index + 1, 0, copy);
      this.renderPreview();
    });

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.className = "small";
    removeBtn.style.marginLeft = "5px";
    removeBtn.addEventListener("click", () => {
      this.selectedQuestions.splice(index, 1);
      this.renderPreview();
    });

    controls.appendChild(duplicateBtn);
    controls.appendChild(removeBtn);
    item.appendChild(leftSection);
    item.appendChild(controls);

    return item;
  }

  /**
   * Initialize drag and drop functionality for preview items
   */
  initializeDragAndDrop() {
    const preview = document.getElementById("assignmentPreview");
    let draggedElement = null;
    let draggedIndex = null;

    // Add event listeners to all draggable items
    const draggableItems = preview.querySelectorAll('.draggable');
    
    draggableItems.forEach(item => {
      item.addEventListener('dragstart', (e) => {
        draggedElement = item;
        draggedIndex = parseInt(item.dataset.index);
        item.style.opacity = '0.5';
        e.dataTransfer.effectAllowed = 'move';
      });

      item.addEventListener('dragend', (e) => {
        item.style.opacity = '1';
        draggedElement = null;
        draggedIndex = null;
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        if (draggedElement && draggedElement !== item) {
          const targetIndex = parseInt(item.dataset.index);
          this.reorderQuestions(draggedIndex, targetIndex);
        }
      });
    });
  }

  /**
   * Reorder questions in the selected questions array
   */
  reorderQuestions(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    
    // Remove the item from its current position
    const movedQuestion = this.selectedQuestions.splice(fromIndex, 1)[0];
    
    // Insert it at the new position
    this.selectedQuestions.splice(toIndex, 0, movedQuestion);
    
    // Re-render the preview to update indices
    this.renderPreview();
  }

  /**
   * Generate final assignment
   */
  generateAssignment() {
    if (this.selectedQuestions.length === 0) {
      alert("Please add at least one question to the preview before generating.");
      return;
    }

    this.displayFinalAssignment();
    
    // Hide builder controls
    document.getElementById("builderSection").classList.add("hidden");
    document.getElementById("questionList").classList.add("hidden");
    document.getElementById("assignmentPreview").classList.add("hidden");
    
    // Hide layout controls
    document.querySelector(".layout-controls").classList.add("hidden");
    
    // Hide title input section
    document.querySelector(".title-input-section").classList.add("hidden");
    
    // Show edit button
    document.getElementById("editSection").classList.remove("hidden");

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Toggle answer key visibility
   */
  toggleAnswerKey() {
    this.showAnswers = !this.showAnswers;
    const answersSection = document.querySelector(".answers");
    const toggleButton = document.getElementById("toggleAnswers");
    
    if (answersSection) {
      answersSection.style.display = this.showAnswers ? "block" : "none";
      toggleButton.textContent = this.showAnswers ? "Hide Answer Key" : "Show Answer Key";
    }
  }

  /**
   * Update the displayed title
   */
  updateDisplayedTitle() {
    const titleElement = document.getElementById("displayTitle");
    if (titleElement) {
      titleElement.textContent = this.customTitle;
    }
  }

  warnLegacyGraphFlags(question) {
    if (!question || !question.id) return;

    const hasLegacyFlags =
      Object.prototype.hasOwnProperty.call(question, "showGraphInQuestion") ||
      Object.prototype.hasOwnProperty.call(question, "showGraphInAnswer");

    if (!hasLegacyFlags || this.legacyGraphWarningIds.has(question.id)) return;

    console.warn(
      `[Graph Deprecation] Question "${question.id}" uses legacy graph flags ` +
      `("showGraphInQuestion"/"showGraphInAnswer"), which are ignored. ` +
      `Use equation-level "showInQuestion"/"showInAnswer" instead.`
    );
    this.legacyGraphWarningIds.add(question.id);
  }

  getInvalidGraphSchemaErrors(question) {
    const fromVariables = Array.isArray(question?.variables?.__errors) ? question.variables.__errors : [];
    const fromQuestion = Array.isArray(question?.variableErrors) ? question.variableErrors : [];
    const allErrors = [...fromVariables, ...fromQuestion];
    return allErrors.filter(error => error?.type === "invalid_variable_schema");
  }

  drawGraphForContext(canvas, question, context = "question") {
    const drawConfig = question?.draw;
    if (!canvas || !drawConfig) {
      return { renderedCount: 0, skippedCount: 0, errors: [] };
    }

    this.warnLegacyGraphFlags(question);

    const schemaErrors = this.getInvalidGraphSchemaErrors(question);
    const graphWindow = drawConfig?.window || drawConfig?.plane || null;
    const variables = question?.variables || {};

    window.DrawingEngine.drawCoordinateGrid(
      canvas.getContext("2d"),
      canvas.width,
      canvas.height,
      graphWindow,
      variables,
      { type: drawConfig?.type, drawConfig }
    );

    if (schemaErrors.length > 0) {
      if (!this.invalidGraphSchemaWarningIds.has(question.id)) {
        const keys = schemaErrors.map(error => error.key).filter(Boolean).join(", ");
        console.error(
          `[Graph Skipped] Question "${question.id}" has invalid variable schema (${keys}). ` +
          `Use "values" instead of "value".`
        );
        this.invalidGraphSchemaWarningIds.add(question.id);
      }

      return {
        renderedCount: 0,
        skippedCount: 0,
        errors: schemaErrors
      };
    }

    const drawResult = window.DrawingEngine.draw(canvas, drawConfig, variables, { context });
    if (Array.isArray(drawResult?.errors) && drawResult.errors.length > 0) {
      console.error(
        `[Graph Errors] Question "${question.id}" (${context})`,
        drawResult.errors
      );
    }
    return drawResult;
  }

  /**
   * Display final assignment with questions and answers
   */
  displayFinalAssignment() {
    const output = document.getElementById("output");
    output.innerHTML = "";

    const generatedQuestions = this.selectedQuestions.map(template =>
      window.QuestionGenerator.generateQuestion(template)
    );
    const hasGraphQuestions = generatedQuestions.some(question => Boolean(question?.draw));
    const graphFootprintPx = this.graphCanvasHeightPx + (this.graphCanvasVerticalMarginPx * 2);
    const graphFootprintPt = this.convertPixelsToPoints(graphFootprintPx);

    // Apply layout settings
    output.className = `columns-${this.questionColumns}`;
    output.style.setProperty('--question-spacing', `${this.questionSpacing}pt`);
    output.style.setProperty('--graph-canvas-footprint', hasGraphQuestions ? `${graphFootprintPt}pt` : "0pt");
    output.style.setProperty('--graph-canvas-vertical-margin', `${this.graphCanvasVerticalMarginPx}px`);

    const answerDiv = document.createElement("div");
    answerDiv.className = "answers";
    answerDiv.style.display = "none";

    const answerTitle = document.createElement("h3");
    answerTitle.textContent = "Answer Key";
    answerDiv.appendChild(answerTitle);

    const selectedCourse = document.getElementById("courseSelect").value;
    const courseName = selectedCourse.replace(/\s*\([^)]*\)\s*$/, "").trim();
    const selectedChapters = this.getSelectedChapters();
    const printHeader = document.createElement("div");
    printHeader.className = "print-assignment-header";

    const courseHeading = document.createElement("span");
    courseHeading.className = "print-course-name";
    courseHeading.textContent = courseName;
    printHeader.appendChild(courseHeading);

    const chapterHeading = document.createElement("span");
    chapterHeading.className = "print-chapter-name";
    chapterHeading.textContent = `| ${selectedChapters.join(", ")}`;
    printHeader.appendChild(chapterHeading);

    const studentDetails = document.createElement("span");
    studentDetails.className = "print-student-details";
    studentDetails.textContent = "| Name: " + "_".repeat(36) + "  Date: " + "_".repeat(16) + "  Period: ____";
    printHeader.appendChild(studentDetails);

    output.appendChild(printHeader);

    // Add custom title
    const titleDiv = document.createElement("div");
    titleDiv.className = "assignment-title";
    titleDiv.innerHTML = `<h2 id="displayTitle">${this.customTitle}</h2>`;
    output.appendChild(titleDiv);

    // Re-bind the toggle event after creating the button
    setTimeout(() => {
      const toggleBtn = document.getElementById("toggleAnswers");
      if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
          this.toggleAnswerKey();
        });
      }
    }, 0);

    generatedQuestions.forEach((question, index) => {
      const hasDrawCanvas = Boolean(question?.draw);
      
      // Create question element
      const questionDiv = document.createElement("div");
      questionDiv.className = "question";
      if (hasGraphQuestions && !hasDrawCanvas) {
        questionDiv.classList.add("question--graph-footprint-reserved");
      }
      
      const difficultyClass = `difficulty-${question.difficulty || 'basic'}`;
      
      questionDiv.innerHTML = `
        <div style="margin-bottom: 12px;">
          <strong>${index + 1})</strong>
          <span class="objective-header">${question.objective || 'No objective'}</span>
          <span class="difficulty-badge ${difficultyClass}" style="margin-left: 8px;">${question.difficulty || 'basic'}</span>
          <span class="question-id" style="margin-left: 8px;">[${question.id || 'No ID'}]</span>
        </div>
        <div>${question.questionText || 'No question text'}</div>
      `;

      output.appendChild(questionDiv);

      // Draw graph if needed
      if (hasDrawCanvas) {
        const canvas = document.createElement("canvas");
        canvas.width = this.graphCanvasWidthPx;
        canvas.height = this.graphCanvasHeightPx;
        questionDiv.appendChild(canvas);
        this.drawGraphForContext(canvas, question, "question");
      }

      const answerItem = document.createElement("div");
      answerItem.className = "answer";
      answerItem.innerHTML = `<strong>${index + 1})</strong> ${question.answer || 'No answer provided'}`;
      answerDiv.appendChild(answerItem);

      if (hasDrawCanvas) {
        const answerCanvas = document.createElement("canvas");
        answerCanvas.width = this.graphCanvasWidthPx;
        answerCanvas.height = this.graphCanvasHeightPx;
        answerItem.appendChild(answerCanvas);
        this.drawGraphForContext(answerCanvas, question, "answer");
      }
    });

    // Add toggle button
    const controlsDiv = document.createElement("div");
    controlsDiv.className = "assignment-controls";
    controlsDiv.innerHTML = `
      <button id="toggleAnswers" class="toggle-answers-btn">Show Answer Key</button>
    `;
    output.appendChild(controlsDiv);
    output.appendChild(answerDiv);

    // Reset answer key visibility
    this.showAnswers = false;

    // Render math
    if (window.MathJax) {
      window.MathJax.typesetPromise();
    }
  }

  /**
   * Edit assignment (return to builder view)
   */
  editAssignment() {
    document.getElementById("builderSection").classList.remove("hidden");
    document.getElementById("questionList").classList.remove("hidden");
    document.getElementById("assignmentPreview").classList.remove("hidden");
    document.getElementById("editSection").classList.add("hidden");
    
    // Show layout controls
    document.querySelector(".layout-controls").classList.remove("hidden");
    
    // Show title input section
    document.querySelector(".title-input-section").classList.remove("hidden");
    
    // Clear output
    document.getElementById("output").innerHTML = "";
    
    // Reset layout classes and styles
    const output = document.getElementById("output");
    output.className = "";
    output.style.removeProperty('--question-spacing');
    output.style.removeProperty('--graph-canvas-footprint');
    output.style.removeProperty('--graph-canvas-vertical-margin');

    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Reset states
    this.showAnswers = false;
  }

  /**
   * Clear question list
   */
  clearQuestionList() {
    document.getElementById("questionList").innerHTML = "";
    this.addAllButtonTop.classList.add("hidden");
    this.currentLoadedQuestions = [];
  }

  /**
   * Save the current assignment as PDF using the browser print pipeline
   */
  async savePdf() {
    // Show loading message
    const saveButton = document.getElementById("savePdfButton");
    const originalText = saveButton.textContent;
    saveButton.textContent = "Opening Print Dialog...";
    saveButton.disabled = true;

    try {
      const outputElement = document.getElementById("output");
      if (!outputElement || outputElement.innerHTML.trim() === "") {
        alert("No assignment to save. Please generate an assignment first.");
        return;
      }

      const titleElement = outputElement.querySelector("#displayTitle");
      const rawTitle = (titleElement?.textContent || "assignment").trim();
      const safeTitle = rawTitle
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
        .replace(/\s+/g, " ")
        .trim() || "assignment";

      const previousTitle = document.title;
      let restored = false;

      const restoreTitle = () => {
        if (restored) return;
        restored = true;
        document.title = previousTitle;
      };

      document.title = safeTitle;

      // Restore title when printing completes
      window.addEventListener("afterprint", restoreTitle, { once: true });

      // Fallback restore in case afterprint is not fired by the browser
      setTimeout(restoreTitle, 3000);

      window.print();

    } catch (error) {
      console.error("Error opening print dialog:", error);
      alert("Error opening print dialog. Please try again.");
    } finally {
      saveButton.textContent = originalText;
      saveButton.disabled = false;
    }
  }
}

window.UIManager = new UIManager();
