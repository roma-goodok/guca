using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Navigation;
using System.Windows.Shapes;
using System.Threading;
using System.ComponentModel;
using AForge;
using AForge.Genetic;
using Physical2DGraph;
using GraphUnfoldingMachine;
using GraphUnfoldingMachine.Genetic;





namespace GeneticGraphUnfoldingMachine
{



    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class GeneticGUMMainWindow : Window
    {
        GUMGraph gumGraph;
        GUMGraphCanvas gumCanvas;

        /// <summary>
        /// Отображаемая хромосома. Либо лучший результат эволюции, либо выбранный пример 
        /// </summary>
        GUMChromosome gumChromosome;
        EvolutionResult evolutionResult;

        // Текущая фитнесс-функция 
        // пересоздаётся по введённым на GUI значениям перед стартом эксперемента и отображением характеристик текущего графа
        PlanarGraphFitnessFunction UsingPlanarGraphFitnessFunction;

        // используется для определения начальных положений узлов
        Random rnd = new Random((Int32)DateTime.Now.Ticks);

       // используется для замера одной итерации GA
        DateTime priorDateTime;
        Dictionary<int, DateTime> priorSeveralIterationDateTimes = new Dictionary<int, DateTime>(10);
        


        int tagCounter;
        int iterationCounterSaved = 0;
        int experimentRepeatCounterSaved = 1;

        private class Arguments
        {

            internal int populationSize = 100;
            /// <summary>
            /// 
            /// </summary>
            internal int maxIterationCount = 100;
            internal int maxExperimentsRepeatsCount = 10;

            internal int chromosomeStartLength = 1000;

            internal int selectionMethod = 0;
            public int chromosomeMaxLength = 1000;

            // начальная популяция. Размер может быть не равным populationSize
            internal List<GUMChromosome> initialPopulation = new List<GUMChromosome>();
            //internal int functionsSet = 0;
            //internal int geneticMethod = 0;

            //internal int I

            public GAParametres geneticAlgorithmParametres = new GAParametres();
            public PlanarGraphFitnessFunction planarGraphFitnessFunction;
        }


        private class Progress
        {
            internal GUMChromosome bestSolution;
            internal double fitness;
            internal double fitnessAvg;
            internal double AgeAvg;
            internal double AgeMax;

            internal int ChromosomeLenghMax;
            internal double ChromosomeLenghAvg;

            internal int ActiveGensCountMax;
            internal double ActiveGensCountAvg;


            internal int iteration;
            internal int ExperimentRepeatCounter;
        }

        
     

        /// <summary>
        /// Результат эволюции. Содержит не только лучшу хромосому но и всью популяцию (для дальнейшего анализа и продолжения эволюции)
        /// </summary>
        private class EvolutionResult
        {
            GUMChromosome bestChromosome;
            List<GUMChromosome> chromosomes = new List<GUMChromosome>();

            public GUMChromosome BestChromosome { get { return bestChromosome; } }
            public List<GUMChromosome> Chromosomes { get { return chromosomes; } }

            public EvolutionResult(GUMChromosome bestChromosome, List<GUMChromosome> chromosomes)
            {
                this.bestChromosome = bestChromosome;
                this.chromosomes = chromosomes;
            }
        }

        private Arguments arguments = new Arguments();
        private String loggingFileName = "log.txt";

        private BackgroundWorker backgroundWorker1;

        bool IsStarted;
        private double priorFitnessValue;
        private int priorLoggedIteration;


        public GeneticGUMMainWindow()
        {
            InitializeComponent();


        //    <gumCanvas:GUMGraphCanvas Name="gumCanvas" ClipToBounds="True" Background="Black"
         // IsEdgesToDisplay="True" IsVerticesToDisplay="True" Margin="0,0,0,0">

        //</gumCanvas:GUMGraphCanvas>

            gumCanvas = new GUMGraphCanvas();
            gumCanvas.Background = new SolidColorBrush(Colors.Black);
            gumCanvas.ClipToBounds = true;
            gumCanvas.IsEdgesToDisplay = true;
            gumCanvas.IsVerticesToDisplay = true;


            mainGrid.Children.Add(gumCanvas);

            //this.AddChild(gumCanvas);

            gumCanvas.OnUpdateVertexRenderShapeEvent += DoUpdateVertexRenderShape;
            gumCanvas.OnUpdateEdgeRenderShapeEvent += DoUpdateEdgeRenderShape;


            backgroundWorker1 = new BackgroundWorker();
            backgroundWorker1.WorkerReportsProgress = true;
            backgroundWorker1.WorkerSupportsCancellation = true;
            backgroundWorker1.DoWork += new System.ComponentModel.DoWorkEventHandler(this.backgroundWorker1_DoWork);
            backgroundWorker1.ProgressChanged += new System.ComponentModel.ProgressChangedEventHandler(this.backgroundWorker1_ProgressChanged);
            backgroundWorker1.RunWorkerCompleted += new System.ComponentModel.RunWorkerCompletedEventHandler(this.backgroundWorker1_RunWorkerCompleted);

            ResetInitialSettings();
        }

        private void ResetInitialSettings()
        {
            GAParametres defaultParametres = new GAParametres();
            tbMutationRatio.Text = defaultParametres.MutationRate.ToString();
            tbCrossingRation.Text = defaultParametres.CrossOverRate.ToString();
            tbRandomSelectionRatio.Text = defaultParametres.RandomSelectionPortion.ToString();
            tbShellVertexWeight.Text = ((double)0.5D).ToString();

            
            tbActiveGenMutationFactor.Text = arguments.geneticAlgorithmParametres.SingleActiveGenMutaionFactor.ToString();
            comboBox_activeGenMutationKind.SelectedIndex = (byte)arguments.geneticAlgorithmParametres.SingleActiveGenMutaionKind;

            tbPassiveGenMutationFactor.Text = arguments.geneticAlgorithmParametres.SinglePassiveGenMutaionFactor.ToString();
            comboBox_passiveGenMutationKind.SelectedIndex = (byte)arguments.geneticAlgorithmParametres.SinglePassiveGenMutaionKind;

            arguments.maxExperimentsRepeatsCount = Int32.Parse(tbExperimentsRepeatsCount.Text);
            tbExperimentsRepeatsCount.Text = arguments.maxExperimentsRepeatsCount.ToString();

            

        }

        private void btnStart_Click(object sender, RoutedEventArgs e)
        {
            


            //gumGraph = null;

            if (IsStarted)
            {
                IsStarted = false;
                // останавливаем процесс
                EnableControls(!IsStarted);
                this.backgroundWorker1.CancelAsync();

               

            }
            else
            {
                IsStarted = true;

                
                arguments.planarGraphFitnessFunction = CreateGraphFitnessFunctionFromGUI();


                UsingPlanarGraphFitnessFunction = arguments.planarGraphFitnessFunction;

                FillArgumentsFromControls(arguments);

                arguments.selectionMethod = comboBox_SelectionMethod.SelectedIndex;
                //arguments.functionsSet = functionsSetBox.SelectedIndex;
                //arguments.geneticMethod = geneticMethodBox.SelectedIndex;

                // update settings controls
                UpdateControls();

                if (evolutionResult != null)
                {
                    arguments.initialPopulation = evolutionResult.Chromosomes;
                }

                // disable all settings controls except "Stop" button
                EnableControls(!IsStarted);

                priorDateTime = DateTime.Now; // для замера времени

                // run worker thread

                backgroundWorker1.RunWorkerAsync(arguments);
            }
        }

        private PlanarGraphFitnessFunction CreateGraphFitnessFunctionFromGUI()
        {

            int maxGUCAIterationCount = Int32.Parse(tbGUCAIterationCount.Text);
            int maxVertexCount = Int32.Parse(tbMaxVertexCount.Text);

            NumericalMethodParametres unfoldingParametres = CreateNumericalMethodparametresFromGUI();

            

            double shellVertexWeight = Double.Parse(tbShellVertexWeight.Text);
            double faset3penaltyProbability = Double.Parse(tbFaset3PenaltyProbability.Text);

            TranscriptionWay transcriptionWay = (TranscriptionWay)cb_TranscriptionWay.SelectedIndex;

            switch (comboBox_FitnessFunctionType.SelectedIndex)
            {
                case 0:
                    {
                        // Определяем статистику выбранного графа
                        gumGraph.Planarize();
                        Dictionary<int, int> aimVerticesDistributionByDegree = gumGraph.GetVerticiesDistributionByDegree();
                        Dictionary<int, int> aimFasetsDistributionByLength = gumGraph.GetFasetsDistributionByLength();

                        return new BySamplePlanarGraphFitnessFunction(
                                            aimFasetsDistributionByLength, aimVerticesDistributionByDegree, maxGUCAIterationCount, maxVertexCount, 
                                            (bool)cbGenomeLengthPenalty.IsChecked, (bool)cbIsNotPlannedPenalty.IsChecked,
                                            unfoldingParametres, transcriptionWay);
                        
                    }
                case 1:
                    {
                        return new TriangleMeshPlanarGraphFitnessFunction(maxGUCAIterationCount, maxVertexCount, (bool)cbGenomeLengthPenalty.IsChecked, (bool)cbIsNotPlannedPenalty.IsChecked, unfoldingParametres, transcriptionWay, shellVertexWeight);
                    }
                case 2:
                    {
                        return new QuadricMeshPlanarGraphFitnessFunction(maxGUCAIterationCount, maxVertexCount, (bool)cbGenomeLengthPenalty.IsChecked, (bool)cbIsNotPlannedPenalty.IsChecked, unfoldingParametres, transcriptionWay, shellVertexWeight, faset3penaltyProbability);
                    }
                case 3:
                    {
                        return new HexMeshPlanarGraphFitnessFunction(maxGUCAIterationCount, maxVertexCount, (bool)cbGenomeLengthPenalty.IsChecked, (bool)cbIsNotPlannedPenalty.IsChecked, unfoldingParametres, transcriptionWay, shellVertexWeight);
                    }


                default:
                    return null;
                    
            }


        }

        private NumericalMethodParametres CreateNumericalMethodparametresFromGUI()
        {
            NumericalMethodParametres unfoldingParametres = new NumericalMethodParametres();
            unfoldingParametres.OneIterationTimeStep = 0.20;
            unfoldingParametres.OneProcessIterationCount = 20;
            unfoldingParametres.OuterIterationCount = Int32.Parse(tbUnfoldingIterationCount.Text);
            return unfoldingParametres;
        }

        private void FillArgumentsFromControls(Arguments arguments)
        {
            // get population size
            try
            {
                arguments.populationSize = Math.Max(10, Math.Min(1000, int.Parse(tbPopulationSize.Text)));
                tbPopulationSize.Text = arguments.populationSize.ToString();
            }
            catch
            {
                arguments.populationSize = 40;
            }
            // iterations
            try
            {
                arguments.maxIterationCount = Math.Max(0, int.Parse(tbIterationCount.Text));
            }
            catch
            {
                arguments.maxIterationCount = 100;
            }

            arguments.maxExperimentsRepeatsCount = Int32.Parse(tbExperimentsRepeatsCount.Text);

            try
            {
                arguments.chromosomeStartLength = Math.Max(0, int.Parse(tbChromosomeStartLength.Text));
                arguments.chromosomeMaxLength = 2 * arguments.chromosomeStartLength;
            }
            catch
            {
                arguments.chromosomeStartLength = 100;
                arguments.chromosomeMaxLength = 200;
            }

            try
            {
                arguments.geneticAlgorithmParametres.MutationRate = double.Parse(tbMutationRatio.Text);
            }
            catch (Exception e)
            {
                MessageBox.Show(e.Message, "Invalid Mutation Ration", MessageBoxButton.OK, MessageBoxImage.Error);
            }

            try
            {
                arguments.geneticAlgorithmParametres.CrossOverRate = double.Parse(tbCrossingRation.Text);
            }
            catch (Exception e)
            {
                MessageBox.Show(e.Message, "Invalid cross over rate", MessageBoxButton.OK, MessageBoxImage.Error);
            }

            try
            {
                arguments.geneticAlgorithmParametres.RandomSelectionPortion = double.Parse(tbRandomSelectionRatio.Text);
            }
            catch (Exception e)
            {
                MessageBox.Show(e.Message, "Invalid 'random selection portion'", MessageBoxButton.OK, MessageBoxImage.Error);

            }

            arguments.geneticAlgorithmParametres.MaxDegreeOfParallelism = Int32.Parse(tbMaxDegreeOfParallelism.Text);

            arguments.geneticAlgorithmParametres.SingleActiveGenMutaionFactor = Double.Parse(tbActiveGenMutationFactor.Text);
            arguments.geneticAlgorithmParametres.SingleActiveGenMutaionKind = (MutationKind)comboBox_activeGenMutationKind.SelectedIndex;
            arguments.geneticAlgorithmParametres.SinglePassiveGenMutaionFactor = Double.Parse(tbPassiveGenMutationFactor.Text);
            arguments.geneticAlgorithmParametres.SinglePassiveGenMutaionKind = (MutationKind)comboBox_passiveGenMutationKind.SelectedIndex;


            
            



            // update settings controls
            UpdateControls();
        }

        private void btnCancel_Click(object sender, RoutedEventArgs e)
        {

            if (MessageBox.Show("Resseting...", "Clear current population?", MessageBoxButton.YesNo, MessageBoxImage.Warning) == MessageBoxResult.Yes)
            {
                this.backgroundWorker1.CancelAsync();
                arguments.initialPopulation = new List<GUMChromosome>();
                iterationCounterSaved = 0;
                experimentRepeatCounterSaved = 0;
                priorSeveralIterationDateTimes.Clear();
            }

            

        }

        private void backgroundWorker1_DoWork(object sender, DoWorkEventArgs e)
        {
            // Get the BackgroundWorker that raised this event.
            BackgroundWorker worker = sender as BackgroundWorker;

            // Assign the result of the computation
            // to the Result property of the DoWorkEventArgs
            // object. This is will be available to the 
            // RunWorkerCompleted eventhandler.
            e.Result = ProcessEvolution((Arguments)e.Argument, worker, e);

        }

        private void backgroundWorker1_ProgressChanged(object sender, ProgressChangedEventArgs e)
        {
            
            //Environment.ProcessorCount, Environment.MachineName, Environment.OSVersion.VersionString, Environment.Is64BitProcess

//            //Namespace Reference
//using System.Management

///// <summary>
///// Return processorId from first CPU in machine
///// </summary>
///// <returns>Hashtable with CPU information</returns>
//public Hashtable GetCPUInfo()
//{
//    //create instance of a hashtable to hold the info
//    Hashtable cpuInfo = new Hashtable();
//    //create an instance of the Managemnet class with the
//    //Win32_Processor class
//    ManagementClass mgmt = new ManagementClass("Win32_Processor");
//    //create a ManagementObjectCollection to loop through
//    ManagementObjectCollection objCol = mgmt.GetInstances();
//    //start our loop for all processors found
//    foreach (ManagementObject obj in objCol)
//    {
//        if (cpuInfo.Count == 0)
//        {
//            // only return cpuInfo from first CPU
//            cpuInfo.Add("ID",obj.Properties["ProcessorId"].Value.ToString());
//            cpuInfo.Add("DeviceID",obj.Properties["DeviceID"].Value.ToString());
//            cpuInfo.Add("Socket", obj.Properties["SocketDesignation"].Value.ToString());
//            cpuInfo.Add("Manufacturer", obj.Properties["Manufacturer"].Value.ToString());
//        }
//        //dispose of our object
//        obj.Dispose();
//    }
//    //return to calling method
//    return cpuInfo;
//}
            
            Progress progress = (Progress)e.UserState;

            DateTime iterataionEndTime = DateTime.Now;

            UnfoldAndDisplayGraphFromChromosome(progress.bestSolution);

            // set current iteration's info
            lbCurentIterationCount.Content = progress.iteration.ToString();
            iterationCounterSaved = progress.iteration;
            if (experimentRepeatCounterSaved != progress.ExperimentRepeatCounter)
            {
                // начался новый эксперимент
                priorSeveralIterationDateTimes.Clear();
                experimentRepeatCounterSaved = progress.ExperimentRepeatCounter;
            }

            


            lbBestFitnessValue.Content = String.Format("{0:F4}", progress.fitness);
            lbFitnessAvgValue.Content = String.Format(" (avg.={0:F4})", progress.fitnessAvg);

            lbBestChromosomeInfo.Content = String.Format(" Age: {0} (avg: {1:F1} , max:{2} )", progress.bestSolution.Age(), progress.AgeAvg, progress.AgeMax);

            lbChromosomeMinMaxAvgLength.Content = String.Format("{0} (avg: {1:F1} , max:{2} )", progress.bestSolution.Length, progress.ChromosomeLenghAvg, progress.ChromosomeLenghMax);

            lbActiveGensInfo.Content = String.Format("{0} (avg: {1:F1} , max:{2} )", progress.bestSolution.activeGensCount, progress.ActiveGensCountAvg, progress.ActiveGensCountMax); 

            #region  подсчитываем среднее время выполнения итерации
            
            // Запоминаем новый осчтёт "номер итерации - дата время" - для подсчёта среднего арифметического времени
            // выполнения последних 10-ти операций
            priorSeveralIterationDateTimes.Add(progress.iteration, iterataionEndTime);

            int minIterationNum = priorSeveralIterationDateTimes.Min(x => x.Key);
            // пока не накопилось мин 10 отсчётов - не удаляем старые
            if (priorSeveralIterationDateTimes.Count() >= 10)
            {
                priorSeveralIterationDateTimes.Remove(minIterationNum);
            };

            minIterationNum = priorSeveralIterationDateTimes.Min(x => x.Key);

            Double avgSeveralIterationTimeInSeconds = 0;

            if (progress.iteration != minIterationNum)
            {
                avgSeveralIterationTimeInSeconds = iterataionEndTime.Subtract(priorSeveralIterationDateTimes[minIterationNum]).TotalSeconds / (progress.iteration - minIterationNum);
            }

            

            TimeSpan iterationInterval = iterataionEndTime.Subtract(priorDateTime);


            lbIterationTime.Content = String.Format("{0:F4} (avg: {1:F4})", iterationInterval.TotalSeconds, avgSeveralIterationTimeInSeconds);

            priorDateTime = DateTime.Now;
            #endregion

            #region Протоколируем изменение фитнессфункции

            if ((progress.iteration % 10 == 0) || (progress.iteration - priorLoggedIteration > 10) || priorFitnessValue != progress.fitness)
            {

                try                
                {
                    int vertexCount = 0;
                    int edgeCount = 0;
                    int fasetsCount = 0;

                    if (gumGraph != null)
                    {
                        vertexCount = gumGraph.VertexCount;
                        edgeCount = gumGraph.EdgeCount;
                        gumGraph.Planarize();
                        fasetsCount = gumGraph.Fasets != null ? gumGraph.Fasets.Count : 0;
                    }

                    StringBuilder sb = new StringBuilder();
                    string s = String.Format("{0}; {1}; {2}; {3}; {4}; {5}; {6}; {7}; {8}; {9}", DateTime.Now.ToString(), progress.iteration, progress.fitness, progress.fitnessAvg, progress.bestSolution.Age(), vertexCount, edgeCount, fasetsCount, progress.bestSolution.activeGensCount, progress.bestSolution.activeGensScheme );
                    sb.AppendLine(s);

                    System.IO.File.AppendAllText(loggingFileName, sb.ToString());
                }
                catch (Exception ex)
                {

                    lbStatus.Content = String.Format("{0} log error: {1}", DateTime.Now.ToString(), ex.Message.ToString());
                }

                priorFitnessValue = progress.fitness;
                priorLoggedIteration = progress.iteration;

            }

            
            #endregion


        }

        private EvolutionResult ProcessEvolution(Arguments arguments, BackgroundWorker worker, DoWorkEventArgs e)
        {
            //// create fitness function
            //SymbolicRegressionFitness fitness = new SymbolicRegressionFitness(arguments.data, new double[] { 1, 2, 3, 5, 7 });
            // create gene function
            //IGPGene gene = (arguments.functionsSet == 0) ?
            //    (IGPGene)new SimpleGeneFunction(6) :
            //    (IGPGene)new ExtendedGeneFunction(6);
            // create population

            List<IChromosome> initialPopulation = new List<IChromosome>(arguments.initialPopulation);

            Population population =
                new Population(arguments.populationSize,
                                initialPopulation,
                                (IChromosome)new GUMChromosome(arguments.chromosomeStartLength, arguments.chromosomeMaxLength,
                                                               arguments.geneticAlgorithmParametres.SingleActiveGenMutaionFactor,
                                                               arguments.geneticAlgorithmParametres.SingleActiveGenMutaionKind,
                                                               arguments.geneticAlgorithmParametres.SinglePassiveGenMutaionFactor,
                                                               arguments.geneticAlgorithmParametres.SinglePassiveGenMutaionKind 
                                                                ),
                                arguments.planarGraphFitnessFunction,
                                (arguments.selectionMethod == 0) ? (ISelectionMethod)new EliteSelection(false) :
                                    (arguments.selectionMethod == 1) ? (ISelectionMethod)new RankSelection() : (ISelectionMethod)new RouletteWheelSelection(),
                                arguments.geneticAlgorithmParametres
                );



            // iterations
            // test
            int iterationCounter = iterationCounterSaved + 1;
            int experimentRepeatCounter = experimentRepeatCounterSaved ;
            //// solution array
            //double[,] solution = new double[50, 2];
            //double[] input = new double[6] { 0, 1, 2, 3, 5, 7 };

            //// calculate X values to be used with solution function
            //for (int j = 0; j < 50; j++)
            //{
            //    solution[j, 0] = chart.RangeX.Min + (double)j * chart.RangeX.Length / 49;
            //}


            // loop
            while (!worker.CancellationPending)
            {
                // run one epoch of genetic algorithm
                population.RunEpoch();

                try
                {
                    // get best solution
                    //GUMChromosome bestChromosome = (GUMChromosome)population.BestChromosome;

                    //// calculate best function
                    //for (int j = 0; j < 50; j++)
                    //{
                    //    input[0] = solution[j, 0];
                    //    solution[j, 1] = PolishExpression.Evaluate(bestFunction, input);
                    //}

                    //// calculate error
                    //double error = 0.0;
                    //for (int j = 0, k = arguments.data.GetLength(0); j < k; j++)
                    //{
                    //    input[0] = arguments.data[j, 0];
                    //    error += Math.Abs(arguments.data[j, 1] - PolishExpression.Evaluate(bestFunction, input));
                    //}

                    Progress progress = new Progress();

                    progress.bestSolution = new GUMChromosome((GUMChromosome)population.BestChromosome);
                    if (progress.bestSolution != null)
                    {
                        progress.fitness = population.BestChromosome.Fitness;
                    }
                    else
                    {
                        progress.fitness = -999;
                    }

                    progress.fitnessAvg = population.FitnessAvg;
                    progress.AgeAvg = population.AgeAvg;
                    progress.AgeMax = population.AgeMax;

                    progress.ChromosomeLenghMax = population.ChromosomeLengthMax;
                    progress.ChromosomeLenghAvg = population.ChromosomeLenghAvg;
                    progress.ActiveGensCountMax = population.ActiveGensCountMax;
                    progress.ActiveGensCountAvg = population.ActiveGensCountAvg;
    


                    progress.iteration = iterationCounter;
                    progress.ExperimentRepeatCounter = experimentRepeatCounter;
                    worker.ReportProgress(iterationCounter, progress);


                }
                catch (Exception)
                {
                    // remove any solutions from chart in case of any errors
                    // chart.UpdateDataSeries("solution", null);
                    gumGraph = null;

                }

                // increase current iteration
                iterationCounter++;

                // выполняем условия останова:
                if ((arguments.maxIterationCount != 0) && (iterationCounter > arguments.maxIterationCount))
                {
                    experimentRepeatCounter++;
                    iterationCounter = 1;
                    population.Regenerate();
                    
                    

                    if (experimentRepeatCounter > arguments.maxExperimentsRepeatsCount)
                    {
                        break;
                    }
                }
            }

            // клонируем список хромосом для передачи результата эволюции:
            List<GUMChromosome> chromosomes = new List<GUMChromosome>();
            foreach (IChromosome c in population.Chromosomes)
            {
                chromosomes.Add((GUMChromosome)c);
            }
            // форируем результат эволюции
            EvolutionResult evolutionResult = new EvolutionResult((GUMChromosome)population.BestChromosome, chromosomes);

            return evolutionResult;
        }



        private void backgroundWorker1_RunWorkerCompleted(object sender, RunWorkerCompletedEventArgs e)
        {
            //this.solutionBox.Text = e text;

            // First, handle the case where an exception was thrown.
            if (e.Error != null)
            {
                MessageBox.Show(e.Error.Message);
            }
            else if (e.Cancelled)
            {


                this.textResult.Text = "Canceled: "; // +e.Result.ToString();
                evolutionResult = (EvolutionResult)e.Result;
                UnfoldAndDisplayGraphFromChromosome(evolutionResult.BestChromosome);
                DisplayPopulsationsStatistic(evolutionResult.Chromosomes);
            }
            else
            {
                // Finally, handle the case where the operation 
                // succeeded.
                //this.textResult.Text = e.Result.ToString();
                this.textResult.Text = "Finished.";
                evolutionResult = (EvolutionResult)e.Result;
                UnfoldAndDisplayGraphFromChromosome(evolutionResult.BestChromosome);
                DisplayPopulsationsStatistic(evolutionResult.Chromosomes);
            }

            EnableControls(true);

        }

        private void DisplayPopulsationsStatistic(List<GUMChromosome> chromosomes)
        {
            #region Отображаем статистику возраста


            //var fasetParts = from x in fasets
            //                 group x by x.Count
            //                     //group x by x.GetMinCycle().Count
            //                     into part
            //                     orderby part.Key
            //                     select new
            //                     {
            //                         Key = part.Key,
            //                         Count = part.Count()
            //                     };


            //Dictionary<int, int> result = new Dictionary<int, int>();
            //foreach (var part in fasetParts)
            //{
            //    result.Add(part.Key, part.Count);
            //}


            var ageDistributionQuery = from x in chromosomes
                                       group x by x.Age()
                                           into part
                                           orderby part.Key
                                           select new
                                           {
                                               Key = part.Key,
                                               Count = part.Count()
                                           };
            //var ageMaxValue =


            StringBuilder sb = new StringBuilder(textResult.Text);

            sb.AppendLine();
            sb.AppendLine("Distribution by age:");

            foreach (var ageItems in ageDistributionQuery)
            {
                sb.AppendLine(String.Format("Age:{0}: {1}", ageItems.Key, ageItems.Count));
            }


            textResult.Text = sb.ToString();


            #endregion
        }

        private void EnableControls(bool isStopped)
        {
            comboBox_Sample.IsEnabled = isStopped;


            btnStart.Content = !isStopped ? "Pause" : "Resume";
            //btnStart.IsEnabled = p;
            btnCancel.IsEnabled = !isStopped;

            btnLoadChangeTable.IsEnabled = isStopped;
        }

        private void UnfoldAndDisplayGraphFromChromosome(GUMChromosome gUMChromosome)
        {
            gumChromosome = gUMChromosome;

            int stepsPassed;
            gumGraph = (GUMGraph)UsingPlanarGraphFitnessFunction.GrowGraph(gumChromosome, out stepsPassed);
            gumGraph.ProcessUnfoldingModel(CreateNumericalMethodparametresFromGUI(), new Point(gumCanvas.ActualWidth, gumCanvas.ActualHeight));
            gumCanvas.Clear();
            gumCanvas.Graph = gumGraph;
            gumCanvas.SetScale(3.0);

            if (combo_ViewOptions.SelectedIndex != 0)
            {
                gumCanvas.DrawGraphToCanvas();
            }
            else
            {
                gumCanvas.Clear();
            }

            if (gumGraph != null)
            {
                //btnCreateTestGraph.IsEnabled = false;

                if (btnDisplayGraphProperties != null) { btnDisplayGraphProperties.IsEnabled = true; }
                //if (btnUseAsFitnessAim != null) { btnUseAsFitnessAim.IsEnabled = true; }
            }


        }

        private void CreateMesh(Physical2DGraph.Physical2DGraph grpah, int rows, int cols)
        {
            Physical2DGraphVertex vStart = this.CreateNewPointInCenter(gumGraph, true);

            int n = rows;
            int m = cols;
            // 1. делаем основу n

            Physical2DGraphVertex vPrior = vStart;
            Physical2DGraphVertex vNext = null;

            for (int i = 0; i < n; i++)
            {
                vNext = this.CreateNewPointInCenter(gumGraph);
                grpah.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vPrior, vNext));
                vPrior = vNext;
            }

            // 2. из основы выращиваем ряды
            // используем знание о том, что n-последних узлов, добавленных в граф это предыдущий ряд
            for (int j = 0; j < m; j++)
            {


                Physical2DGraphVertex[] priorRow = grpah.Vertices.Reverse().Take(n + 1).ToArray();

                // создаём новый ряд:
                for (int i = 0; i < n + 1; i++)
                {
                    Physical2DGraphVertex v = priorRow[i];
                    grpah.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(v, this.CreateNewPointInCenter(gumGraph)));

                }

                // соединаем узлы нового ряда
                Physical2DGraphVertex[] newRow = grpah.Vertices.Reverse().Take(n + 1).ToArray();


                for (int i = 0; i < n + 1; i++)
                {
                    Physical2DGraphVertex v = newRow[i];
                    if (i > 0) { grpah.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(newRow[i - 1], v)); };
                }



            }

        }

        private void CreateQuadricRingMesh(Physical2DGraph.Physical2DGraph grpah, int rows, int cols)
        {
            Physical2DGraphVertex vStart = this.CreateNewPointInCenter(gumGraph, true);

            int n = rows - 1;
            int m = cols;
            // 1. делаем основу n

            Physical2DGraphVertex vPrior = vStart;
            Physical2DGraphVertex vNext = null;

            for (int i = 0; i < n; i++)
            {
                vNext = this.CreateNewPointInCenter(gumGraph);
                grpah.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vPrior, vNext));
                vPrior = vNext;
            }
            grpah.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vNext, vStart));


            // 2. из основы выращиваем ряды
            // используем знание о том, что n-последних узлов, добавленных в граф это предыдущий ряд
            for (int j = 0; j < m; j++)
            {


                Physical2DGraphVertex[] priorRow = grpah.Vertices.Reverse().Take(n + 1).ToArray();

                // создаём новый ряд:
                for (int i = 0; i < n + 1; i++)
                {
                    Physical2DGraphVertex v = priorRow[i];
                    grpah.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(v, this.CreateNewPointInCenter(gumGraph)));

                }

                // соединаем узлы нового ряда
                Physical2DGraphVertex[] newRow = grpah.Vertices.Reverse().Take(n + 1).ToArray();


                for (int i = 0; i < n + 1; i++)
                {
                    Physical2DGraphVertex v = newRow[i];
                    if (i > 0) { grpah.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(newRow[i - 1], v)); };
                }
                grpah.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(newRow[0], newRow[n]));



            }

        }

        private Physical2DGraphVertex CreateNewPointInCenter(Physical2DGraph.Physical2DGraph grpah, bool clearTagCounter = false)
        {
            if (clearTagCounter)
            {
                tagCounter = 1;
            }



            Physical2DGraphVertex v = new Physical2DGraphVertex(new Point(gumCanvas.ActualWidth * 0.5 + grpah.PhysicalModelParametres.FreeConnectionLength * rnd.NextDouble(),
                                                                          gumCanvas.ActualHeight * 0.5 + grpah.PhysicalModelParametres.FreeConnectionLength * rnd.NextDouble()
                                                                          )
                                                                );
            grpah.AddVertex(v);

            //if ((bool)cbMarkVertex.IsChecked) { v.Tag = tagCounter.ToString(); }
            tagCounter++;

            return v;


        }


        private void comboBox_Sample_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            gumGraph = new GUMGraph();
            gumCanvas.Clear();
            gumCanvas.Graph = gumGraph;

            // заполняем тестовый граф вершинами и рёбрами, в зависимости от примера
            switch (comboBox_Sample.SelectedIndex)
            {
                case 0: // дерево
                    {
                        #region пример 1 - дерево

                        Physical2DGraphVertex vA = new Physical2DGraphVertex(new Point(100, 100));
                        vA.Tag = "A";
                        gumGraph.AddVertex(vA);

                        Physical2DGraphVertex vB = new Physical2DGraphVertex(new Point(100, 50));
                        vB.Tag = "B";
                        gumGraph.AddVertex(vB);

                        Physical2DGraphVertex vC = new Physical2DGraphVertex(new Point(150, 75));
                        vC.Tag = "C";
                        gumGraph.AddVertex(vC);

                        Physical2DGraphVertex vD = new Physical2DGraphVertex(new Point(80, 200));
                        vD.Tag = "D";
                        gumGraph.AddVertex(vD);


                        Physical2DGraphVertex vE = new Physical2DGraphVertex(new Point(175, 200));
                        vE.Tag = "E";
                        gumGraph.AddVertex(vE);

                        Physical2DGraphVertex vF = new Physical2DGraphVertex(new Point(200, 100));
                        vF.Tag = "F";
                        gumGraph.AddVertex(vF);

                        Physical2DGraphVertex vG = new Physical2DGraphVertex(new Point(300, 100));
                        vG.Tag = "G";
                        gumGraph.AddVertex(vG);

                        Physical2DGraphVertex vH = new Physical2DGraphVertex(new Point(50, 75));
                        vH.Tag = "H";
                        gumGraph.AddVertex(vH);

                        Physical2DGraphVertex vK = new Physical2DGraphVertex(new Point(250, 50));
                        vK.Tag = "K";
                        gumGraph.AddVertex(vK);

                        Physical2DGraphVertex vL = new Physical2DGraphVertex(new Point(330, 175));
                        vL.Tag = "L";
                        gumGraph.AddVertex(vL);

                        Physical2DGraphVertex vM = new Physical2DGraphVertex(new Point(260, 150));
                        vM.Tag = "M";
                        gumGraph.AddVertex(vM);

                        Physical2DGraphVertex vN = new Physical2DGraphVertex(new Point(270, 200));
                        vN.Tag = "N";
                        gumGraph.AddVertex(vN);

                        Physical2DGraphVertex vU = new Physical2DGraphVertex(new Point(45, 150));
                        vU.Tag = "U";
                        gumGraph.AddVertex(vU);


                        Physical2DGraphEdge<Physical2DGraphVertex> edgeAH = new Physical2DGraphEdge<Physical2DGraphVertex>(vA, vH);

                        gumGraph.AddEdge(edgeAH);

                        Physical2DGraphEdge<Physical2DGraphVertex> edgeBA = new Physical2DGraphEdge<Physical2DGraphVertex>(vB, vA);

                        gumGraph.AddEdge(edgeBA);

                        Physical2DGraphEdge<Physical2DGraphVertex> edgeUA = new Physical2DGraphEdge<Physical2DGraphVertex>(vU, vA);

                        gumGraph.AddEdge(edgeUA);

                        Physical2DGraphEdge<Physical2DGraphVertex> edgeDA = new Physical2DGraphEdge<Physical2DGraphVertex>(vD, vA);

                        gumGraph.AddEdge(edgeDA);

                        Physical2DGraphEdge<Physical2DGraphVertex> edgeAC = new Physical2DGraphEdge<Physical2DGraphVertex>(vA, vC);

                        gumGraph.AddEdge(edgeAC);

                        Physical2DGraphEdge<Physical2DGraphVertex> edgeCE = new Physical2DGraphEdge<Physical2DGraphVertex>(vC, vE);

                        gumGraph.AddEdge(edgeCE);

                        Physical2DGraphEdge<Physical2DGraphVertex> edgeCF = new Physical2DGraphEdge<Physical2DGraphVertex>(vC, vF);

                        gumGraph.AddEdge(edgeCF);

                        Physical2DGraphEdge<Physical2DGraphVertex> edgeFK = new Physical2DGraphEdge<Physical2DGraphVertex>(vF, vK);

                        gumGraph.AddEdge(edgeFK);

                        Physical2DGraphEdge<Physical2DGraphVertex> edgeFM = new Physical2DGraphEdge<Physical2DGraphVertex>(vF, vM);

                        gumGraph.AddEdge(edgeFM);

                        Physical2DGraphEdge<Physical2DGraphVertex> edgeMG = new Physical2DGraphEdge<Physical2DGraphVertex>(vM, vG);

                        gumGraph.AddEdge(edgeMG);

                        Physical2DGraphEdge<Physical2DGraphVertex> edgeGN = new Physical2DGraphEdge<Physical2DGraphVertex>(vG, vN);

                        gumGraph.AddEdge(edgeGN);

                        Physical2DGraphEdge<Physical2DGraphVertex> edgeGL = new Physical2DGraphEdge<Physical2DGraphVertex>(vG, vL);

                        gumGraph.AddEdge(edgeGL);




                        #endregion
                        break;
                    };
                case 1: // обобщённый пример 1
                    {
                        #region пример 2 - обобщённый

                        Physical2DGraphVertex vA = new Physical2DGraphVertex(new Point(100, 100));
                        vA.Tag = "A";
                        gumGraph.AddVertex(vA);

                        Physical2DGraphVertex vB = new Physical2DGraphVertex(new Point(100, 50));
                        vB.Tag = "B";
                        gumGraph.AddVertex(vB);

                        Physical2DGraphVertex vC = new Physical2DGraphVertex(new Point(150, 75));
                        vC.Tag = "C";
                        gumGraph.AddVertex(vC);

                        Physical2DGraphVertex vD = new Physical2DGraphVertex(new Point(80, 200));
                        vD.Tag = "D";
                        gumGraph.AddVertex(vD);


                        Physical2DGraphVertex vE = new Physical2DGraphVertex(new Point(175, 200));
                        vE.Tag = "E";
                        gumGraph.AddVertex(vE);

                        Physical2DGraphVertex vF = new Physical2DGraphVertex(new Point(200, 100));
                        vF.Tag = "F";
                        gumGraph.AddVertex(vF);

                        Physical2DGraphVertex vG = new Physical2DGraphVertex(new Point(300, 100));
                        vG.Tag = "G";
                        gumGraph.AddVertex(vG);

                        Physical2DGraphVertex vH = new Physical2DGraphVertex(new Point(50, 75));
                        vH.Tag = "H";
                        gumGraph.AddVertex(vH);

                        Physical2DGraphVertex vK = new Physical2DGraphVertex(new Point(250, 50));
                        vK.Tag = "K";
                        gumGraph.AddVertex(vK);

                        Physical2DGraphVertex vL = new Physical2DGraphVertex(new Point(330, 175));
                        vL.Tag = "L";
                        gumGraph.AddVertex(vL);

                        Physical2DGraphVertex vM = new Physical2DGraphVertex(new Point(260, 150));
                        vM.Tag = "M";
                        gumGraph.AddVertex(vM);

                        Physical2DGraphVertex vN = new Physical2DGraphVertex(new Point(270, 200));
                        vN.Tag = "N";
                        gumGraph.AddVertex(vN);

                        Physical2DGraphVertex vU = new Physical2DGraphVertex(new Point(45, 150));
                        vU.Tag = "U";
                        gumGraph.AddVertex(vU);

                        Physical2DGraphVertex v1 = new Physical2DGraphVertex(new Point(55, 170));
                        v1.Tag = "1";
                        gumGraph.AddVertex(v1);

                        Physical2DGraphVertex v2 = new Physical2DGraphVertex(new Point(45, 190));
                        v2.Tag = "2";
                        gumGraph.AddVertex(v2);


                        Physical2DGraphVertex vV = new Physical2DGraphVertex(new Point(380, 175));
                        vV.Tag = "V";
                        gumGraph.AddVertex(vV);

                        Physical2DGraphVertex vW = new Physical2DGraphVertex(new Point(380, 225));
                        vW.Tag = "W";
                        gumGraph.AddVertex(vW);



                        Physical2DGraphVertex vO = new Physical2DGraphVertex(new Point(100, 125));
                        vO.Tag = "O";
                        gumGraph.AddVertex(vO);

                        Physical2DGraphVertex vP = new Physical2DGraphVertex(new Point(80, 150));
                        vP.Tag = "P";
                        gumGraph.AddVertex(vP);

                        Physical2DGraphVertex vQ = new Physical2DGraphVertex(new Point(120, 160));
                        vQ.Tag = "Q";
                        gumGraph.AddVertex(vQ);

                        Physical2DGraphVertex vR = new Physical2DGraphVertex(new Point(100, 180));
                        vR.Tag = "R";
                        gumGraph.AddVertex(vR);

                        Physical2DGraphVertex vS = new Physical2DGraphVertex(new Point(110, 75));
                        vS.Tag = "S";
                        gumGraph.AddVertex(vS);

                        Physical2DGraphVertex vT = new Physical2DGraphVertex(new Point(40, 20));
                        vT.Tag = "T";
                        gumGraph.AddVertex(vT);

                        Physical2DGraphVertex vX = new Physical2DGraphVertex(new Point(210, 210));
                        vX.Tag = "X";
                        gumGraph.AddVertex(vX);

                        Physical2DGraphVertex vY = new Physical2DGraphVertex(new Point(190, 250));
                        vY.Tag = "Y";
                        gumGraph.AddVertex(vY);

                        Physical2DGraphVertex vZ = new Physical2DGraphVertex(new Point(5, 300));
                        vZ.Tag = "Z";
                        gumGraph.AddVertex(vZ);


                        Physical2DGraphEdge<Physical2DGraphVertex> edgeAH = new Physical2DGraphEdge<Physical2DGraphVertex>(vA, vH);
                        //edgeAH.IsEmbededFromTargetToSource = true;
                        gumGraph.AddEdge(edgeAH);

                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vA, vC));

                        Physical2DGraphEdge<Physical2DGraphVertex> edgeDH = new Physical2DGraphEdge<Physical2DGraphVertex>(vD, vH);
                        //edgeDH.IsEmbededFromSourceToTarget = true;
                        gumGraph.AddEdge(edgeDH);


                        Physical2DGraphEdge<Physical2DGraphVertex> edgeED = new Physical2DGraphEdge<Physical2DGraphVertex>(vE, vD);
                        //edgeED.IsEmbededFromSourceToTarget = true;
                        gumGraph.AddEdge(edgeED);



                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vE, vC));
                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vC, vB));
                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vH, vB));


                        Physical2DGraphEdge<Physical2DGraphVertex> edgeEA = new Physical2DGraphEdge<Physical2DGraphVertex>(vE, vA);
                        //edgeEA.IsEmbededFromTargetToSource = true;
                        //edgeEA.IsPassedFromTargetToSource = true;

                        gumGraph.AddEdge(edgeEA);

                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vF, vC));
                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vF, vK));
                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vM, vF));
                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vK, vG));
                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vM, vG));

                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vL, vG));

                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vL, vV));

                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vW, vL));


                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vM, vN));

                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vS, vA));

                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vA, vO));

                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vP, vO));

                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vO, vQ));

                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vP, vQ));

                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vQ, vR));

                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vR, vP));

                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vH, vT));

                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vT, vB));

                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vE, vX));

                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vE, vY));

                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vX, vY));

                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vZ, vH));

                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vZ, vE));

                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vH, vU));

                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(v1, vU));

                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(v1, v2));

                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(v2, vD));


                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vE, vF));
                        gumGraph.AddEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vE, vM));




                        #endregion

                        break;
                    };
                case 2: // обобщённый пример 2
                    {
                        #region пример 3 - обобщённый
                        Physical2DGraphVertex vA = new Physical2DGraphVertex(new Point(100, 100));
                        vA.Tag = "A";
                        gumGraph.AddVertex(vA);

                        Physical2DGraphVertex vB = new Physical2DGraphVertex(new Point(100, 50));
                        vB.Tag = "B";
                        gumGraph.AddVertex(vB);

                        Physical2DGraphVertex vC = new Physical2DGraphVertex(new Point(150, 75));
                        vC.Tag = "C";
                        gumGraph.AddVertex(vC);

                        Physical2DGraphVertex vD = new Physical2DGraphVertex(new Point(80, 200));
                        vD.Tag = "D";
                        gumGraph.AddVertex(vD);

                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vA, vB));
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vB, vC));
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vB, vD));

                        MessageBox.Show(String.Format("vertices count {0}", gumGraph.VertexCount));


                        #endregion
                        break;
                    }
                case 3: // Кольцо-6
                    {
                        #region Кольцо 6


                        Physical2DGraphVertex vStart = this.CreateNewPointInCenter(gumGraph);
                        Physical2DGraphVertex vPrior = vStart;
                        Physical2DGraphVertex vNext = null;

                        for (int i = 0; i < 5; i++)
                        {
                            vNext = this.CreateNewPointInCenter(gumGraph);
                            gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vPrior, vNext));
                            vPrior = vNext;
                        }
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vNext, vStart));

                        this.Unfold(gumGraph);

                        gumCanvas.SetScale(2.0);

                        #endregion
                        break;
                    }

                case 4: // Волосатое кольцо-6
                    {
                        #region


                        Physical2DGraphVertex vStart = this.CreateNewPointInCenter(gumGraph);
                        Physical2DGraphVertex vLeaf = this.CreateNewPointInCenter(gumGraph);
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vStart, vLeaf));

                        Physical2DGraphVertex vPrior = vStart;
                        Physical2DGraphVertex vNext = null;

                        for (int i = 0; i < 5; i++)
                        {
                            vNext = this.CreateNewPointInCenter(gumGraph);
                            gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vPrior, vNext));
                            vLeaf = this.CreateNewPointInCenter(gumGraph);
                            gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vNext, vLeaf));
                            vPrior = vNext;
                        }
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vNext, vStart));

                        this.Unfold(gumGraph);

                        gumCanvas.SetScale(2.0);

                        #endregion
                        break;
                    }

                case 5: // Треугольник с деревьями-6
                    {
                        #region


                        Physical2DGraphVertex vStart = this.CreateNewPointInCenter(gumGraph);
                        Physical2DGraphVertex vTree = this.CreateNewPointInCenter(gumGraph);
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vStart, vTree));
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vTree, this.CreateNewPointInCenter(gumGraph)));
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vTree, this.CreateNewPointInCenter(gumGraph)));

                        Physical2DGraphVertex vPrior = vStart;
                        Physical2DGraphVertex vNext = null;

                        for (int i = 0; i < 2; i++)
                        {
                            vNext = this.CreateNewPointInCenter(gumGraph);
                            gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vPrior, vNext));
                            vTree = this.CreateNewPointInCenter(gumGraph);
                            gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vNext, vTree));
                            gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vTree, this.CreateNewPointInCenter(gumGraph)));
                            gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vTree, this.CreateNewPointInCenter(gumGraph)));
                            vPrior = vNext;
                        }
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vNext, vStart));


                        this.Unfold(gumGraph);

                        gumCanvas.SetScale(2.0);

                        #endregion
                        break;
                    }
                case 6: // Кольцо c нитью 6
                    {
                        #region


                        Physical2DGraphVertex vStart = this.CreateNewPointInCenter(gumGraph);

                        Physical2DGraphVertex vPrior = vStart;
                        Physical2DGraphVertex vNext = null;

                        for (int i = 0; i < 5; i++)
                        {
                            vNext = this.CreateNewPointInCenter(gumGraph);
                            gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vPrior, vNext));
                            vPrior = vNext;
                        }
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vNext, vStart));

                        for (int i = 0; i < 3; i++)
                        {
                            vNext = this.CreateNewPointInCenter(gumGraph);
                            gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vPrior, vNext));
                            vPrior = vNext;
                        }

                        this.Unfold(gumGraph);

                        gumCanvas.SetScale(2.0);

                        #endregion
                        break;
                    }
                case 7: // Кольцо-8
                    {
                        #region

                        Physical2DGraphVertex vStart = this.CreateNewPointInCenter(gumGraph);

                        Physical2DGraphVertex vPrior = vStart;
                        Physical2DGraphVertex vNext = null;

                        for (int i = 0; i < 7; i++)
                        {
                            vNext = this.CreateNewPointInCenter(gumGraph);
                            gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vPrior, vNext));
                            vPrior = vNext;
                        }
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vNext, vStart));


                        this.Unfold(gumGraph);

                        gumCanvas.SetScale(2.0);

                        #endregion
                        break;
                    }
                case 8: // Нитка-7
                    {
                        #region

                        Physical2DGraphVertex vStart = this.CreateNewPointInCenter(gumGraph);

                        Physical2DGraphVertex vPrior = vStart;
                        Physical2DGraphVertex vNext = null;

                        for (int i = 0; i < 6; i++)
                        {
                            vNext = this.CreateNewPointInCenter(gumGraph);
                            gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vPrior, vNext));
                            vPrior = vNext;
                        }



                        this.Unfold(gumGraph);

                        gumCanvas.SetScale(2.0);

                        #endregion
                        break;
                    }
                case 9: // Звёздочка-6
                    {
                        #region

                        Physical2DGraphVertex vStart = this.CreateNewPointInCenter(gumGraph);

                        for (int i = 0; i < 5; i++)
                        {

                            gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vStart, this.CreateNewPointInCenter(gumGraph)));

                        }

                        this.Unfold(gumGraph);
                        gumCanvas.SetScale(2.0);

                        #endregion
                        break;
                    }
                case 10: // Mesh-1 (квадратная сетка 3x3)
                    {
                        #region

                        this.CreateMesh(gumGraph, 3, 3);

                        this.Unfold(gumGraph);
                        gumCanvas.SetScale(2.0);

                        #endregion
                        break;
                    }
                case 11: // Mesh-2 (квадратная сетка 9x1)
                    {
                        #region

                        this.CreateMesh(gumGraph, 9, 1);

                        this.Unfold(gumGraph);
                        gumCanvas.SetScale(2.0);

                        #endregion
                        break;
                    }

                case 12: // Mesh-3 (квадратная сетка-кольцо)
                    {
                        #region

                        this.CreateQuadricRingMesh(gumGraph, 9, 1);

                        this.Unfold(gumGraph);
                        gumCanvas.SetScale(2.0);

                        #endregion
                        break;
                    }
                case 13: // Mesh-4 (квадратная сетка 4x2)
                    {
                        #region

                        this.CreateMesh(gumGraph, 4, 2);

                        this.Unfold(gumGraph);
                        gumCanvas.SetScale(2.0);

                        #endregion
                        break;
                    }
                case 14: // Mesh-5 (квадратная сетка 4x4)
                    {
                        #region

                        this.CreateMesh(gumGraph, 4, 4);

                        this.Unfold(gumGraph);
                        gumCanvas.SetScale(2.0);

                        #endregion
                        break;
                    }
                case 15: // Mesh-6 (квадратная сетка 6x6)
                    {
                        #region

                        this.CreateMesh(gumGraph, 6, 6);

                        this.Unfold(gumGraph);
                        gumCanvas.SetScale(2.0);

                        #endregion
                        break;
                    }
                case 16: // Mesh-7 (квадратная сетка 2x2 + листья)
                    {
                        #region

                        this.CreateMesh(gumGraph, 2, 2);

                        foreach (Physical2DGraphVertex v in gumGraph.Vertices.Reverse().Take(3).ToArray())
                        {
                            gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(v, this.CreateNewPointInCenter(gumGraph)));
                        }

                        foreach (Physical2DGraphVertex v in gumGraph.Vertices.Take(3).ToArray())
                        {
                            gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(v, this.CreateNewPointInCenter(gumGraph)));
                        }


                        this.Unfold(gumGraph);
                        gumCanvas.SetScale(2.0);

                        #endregion
                        break;
                    }
                case 17: // Mesh-8 (квадратная цепочка)
                    {
                        #region

                        //this.CreateMesh(gumGraph, 6, 6);
                        Physical2DGraphVertex vStart = this.CreateNewPointInCenter(gumGraph);


                        Physical2DGraphVertex vNext1 = null;
                        Physical2DGraphVertex vNext2 = null;
                        Physical2DGraphVertex vNext = vStart;

                        for (int i = 0; i < 9; i++)
                        {
                            vNext1 = this.CreateNewPointInCenter(gumGraph);
                            vNext2 = this.CreateNewPointInCenter(gumGraph);
                            gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vNext, vNext1));
                            gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vNext, vNext2));
                            vNext = this.CreateNewPointInCenter(gumGraph);
                            gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vNext1, vNext));
                            gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vNext2, vNext));
                        }


                        this.Unfold(gumGraph);
                        gumCanvas.SetScale(4.0);

                        #endregion
                        break;
                    }
                case 18: // Mesh-9 (квадратная крест и листья)
                    {
                        #region

                        this.CreateMesh(gumGraph, 1, 1);

                        Physical2DGraphVertex[] centerVertexArray = gumGraph.Vertices.ToArray();

                        for (int i = 0; i < 4; i++)
                        {
                            Physical2DGraphVertex vNext1 = this.CreateNewPointInCenter(gumGraph);
                            Physical2DGraphVertex vNext2 = this.CreateNewPointInCenter(gumGraph);

                            int nextInd = i < 3 ? i + 1 : 0;

                            gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(centerVertexArray[i], vNext1));
                            gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(centerVertexArray[nextInd], vNext2));
                            gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vNext1, vNext2));

                            gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vNext1, this.CreateNewPointInCenter(gumGraph)));
                            gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vNext2, this.CreateNewPointInCenter(gumGraph)));

                        }

                        this.Unfold(gumGraph);
                        gumCanvas.SetScale(3.5);

                        #endregion
                        break;
                    }

                case 19: // Mesh-10 (треугольная сетка)
                    {
                        #region
                        Physical2DGraphVertex vCenter = this.CreateNewPointInCenter(gumGraph);

                        Physical2DGraphVertex vFirst = null;
                        Physical2DGraphVertex vPrior = null;

                        for (int i = 0; i < 6; i++)
                        {
                            Physical2DGraphVertex vNext = this.CreateNewPointInCenter(gumGraph);
                            gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vCenter, vNext));


                            if (i > 0)
                            {
                                gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vNext, vPrior));
                                if (i == 5)
                                {
                                    // соединяем  с первым
                                    gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vNext, vFirst));
                                }
                            }
                            else
                            {
                                vFirst = vNext;
                            }

                            vPrior = vNext;

                        }

                        this.Unfold(gumGraph);
                        gumCanvas.SetScale(3.5);

                        #endregion
                        break;
                    }

                case 20: // Mesh-11 (дефектная треугольная сетка)
                    {
                        #region
                        Physical2DGraphVertex vCenter = this.CreateNewPointInCenter(gumGraph);

                        Physical2DGraphVertex vFirst = null;
                        Physical2DGraphVertex vPrior = null;

                        for (int i = 0; i < 5; i++)
                        {
                            Physical2DGraphVertex vNext = this.CreateNewPointInCenter(gumGraph);
                            gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vCenter, vNext));


                            if (i > 0)
                            {
                                gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vNext, vPrior));
                                if (i == 4)
                                {
                                    Physical2DGraphVertex vDefect = this.CreateNewPointInCenter(gumGraph);
                                    gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vNext, vDefect));
                                    // соединяем  с первым
                                    gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vDefect, vFirst));
                                }
                            }
                            else
                            {
                                vFirst = vNext;
                            }

                            vPrior = vNext;

                        }

                        this.Unfold(gumGraph);
                        gumCanvas.SetScale(3.5);

                        #endregion
                        break;
                    }

                case 21: // Mesh-12 (дефектная квадратная сетка)
                    {
                        #region
                        //Physical2DGraphVertex vCenter = this.CreateNewPointInCenter(gumGraph);

                        //Physical2DGraphVertex vFirst = null;
                        //Physical2DGraphVertex vPrior = null;

                        for (int i = 0; i < 16; i++)
                        {
                            this.CreateNewPointInCenter(gumGraph);
                        }

                        Physical2DGraphVertex[] vArr = gumGraph.Vertices.ToArray();

                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vArr[0], vArr[1]));
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vArr[1], vArr[2]));
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vArr[3], vArr[2]));
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vArr[0], vArr[3]));
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vArr[0], vArr[1]));
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vArr[1], vArr[5]));
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vArr[5], vArr[2]));
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vArr[3], vArr[4]));
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vArr[4], vArr[0]));
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vArr[4], vArr[9]));
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vArr[0], vArr[8]));
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vArr[7], vArr[1]));
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vArr[7], vArr[6]));
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vArr[5], vArr[6]));
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vArr[6], vArr[15]));
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vArr[15], vArr[14]));
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vArr[14], vArr[7]));
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vArr[7], vArr[8]));
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vArr[10], vArr[8]));
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vArr[10], vArr[11]));
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vArr[11], vArr[9]));
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vArr[11], vArr[12]));
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vArr[12], vArr[13]));
                        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vArr[13], vArr[10]));


                        //    gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vCenter, vNext));


                        //    if (i > 0)
                        //    {
                        //        gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vNext, vPrior));
                        //        if (i == 4)
                        //        {
                        //            Physical2DGraphVertex vDefect = this.CreateNewPointInCenter(gumGraph);
                        //            gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vNext, vDefect));
                        //            // соединяем  с первым
                        //            gumGraph.AddVerticesAndEdge(new Physical2DGraphEdge<Physical2DGraphVertex>(vDefect, vFirst));
                        //        }
                        //    }
                        //    else
                        //    {
                        //        vFirst = vNext;
                        //    }

                        //    vPrior = vNext;

                        //}

                        this.Unfold(gumGraph);
                        gumCanvas.SetScale(3.5);

                        #endregion
                        break;
                    }




                default:
                    break;
            }




            if (combo_ViewOptions.SelectedIndex != 0)
            {
                gumCanvas.DrawGraphToCanvas();
            }
            else
            {
                gumCanvas.Clear();
            }


            UpdateControls();
            textBlock_PlanarStatistics.Text = "";
        }

        
        private void Unfold(GUMGraph gumGraph)
        {
            NumericalMethodParametres parametres = new NumericalMethodParametres();
            parametres.OneIterationTimeStep = 0.2;
            parametres.OneProcessIterationCount = 20;
            parametres.OuterIterationCount = 20;
            gumGraph.ProcessUnfoldingModel(parametres);

        }
        



        private void btnDisplayFenotype_Click(object sender, RoutedEventArgs e)
        {
            UnfoldAndDisplayGraphFromChromosome(gumChromosome);



        }

        private void btnDisplayGraphProperties_Click(object sender, RoutedEventArgs e)
        {
            // 0. Для отладки: нумеруем вершины графа

            //{
            //    int counter = 1;
            //    foreach (Physical2DGraphVertex v in gumGraph.Vertices)
            //    {
            //        v.Tag = counter.ToString();
            //        counter++;

            //    }
            //}           

           
            

            if (gumGraph != null)
            {



                // 1. вызываем метод планаразации гарфа.                
                gumGraph.Planarize();


                bool isPlanned = gumGraph.IsPlanned();

                // 2. Отображаем количество найденых граней
                // 2.1 отображаем количество
                //MessageBox.Show(String.Format("Количество найденых граней: {0}", fasets.Count));
                // 2.2 отображаем грани, меняя цвет грани
                foreach (Physical2DGraphEdge<Physical2DGraphVertex> edge in gumGraph.Edges)
                {
                    edge.IsBelongToFacet = false;
                }

                foreach (Cycle<Physical2DGraphVertex> faset in gumGraph.Fasets)
                {
                    foreach (Physical2DGraphEdge<Physical2DGraphVertex> edge in faset)
                    {
                        edge.IsBelongToFacet = true;
                    }
                }

                if (combo_ViewOptions.SelectedIndex != 0)
                {
                    gumCanvas.DrawGraphToCanvas();
                }
                else
                {
                    gumCanvas.Clear();
                }

                #region 3. отображаем статистику графа
                /* 3.1 : статистику по узлам:
             * - всего узлов, узлов с количеством соседей
             */
                StringBuilder sb = new StringBuilder();


                #region Отображаем свойства хромосомы:
                if (gumChromosome != null)
                {
                    sb.AppendLine("chromosome: ");
                    sb.AppendLine(String.Format(" Length:{0}; age: {1}, active gens: {2};", gumChromosome.Length, gumChromosome.Age(), gumChromosome.activeGensCount));
                    sb.AppendLine(String.Format(" scheme: {0}", gumChromosome.activeGensScheme));

                    sb.AppendLine();
                }
                #endregion

                sb.AppendLine("graph properties:");

                UsingPlanarGraphFitnessFunction = CreateGraphFitnessFunctionFromGUI();

                if (UsingPlanarGraphFitnessFunction != null)
                {
                    // - рассчитываем фитнесс-функцию
                    double fitnessValue = UsingPlanarGraphFitnessFunction.Evaluate(gumGraph);
                    sb.AppendLine(String.Format("Fitness value: {0}", fitnessValue));
                }

                sb.AppendLine(String.Format("Planar:{0}, planned:{1}, isBeconnected:{2}", gumGraph.IsPlanar, isPlanned, gumGraph.IsBeconnected()));
                sb.AppendLine(String.Format("Vertices: Total count = {0}", gumGraph.VertexCount));

                Dictionary<int, int> vertParts = gumGraph.GetVerticiesDistributionByDegree();

                foreach (var part in vertParts)
                {

                    sb.AppendLine(String.Format("  vertices with {0} edges count: {1}", part.Key, part.Value));
                }

                sb.AppendLine();
                /* 3.1 : статистику по граням:
                 * - всего граней, граней с количеством рёбер
                 */
                sb.AppendLine(String.Format("Fasets: Total count = {0}", gumGraph.Fasets.Count));

                Dictionary<int, int> fasetParts = gumGraph.GetFasetsDistributionByLength();

                foreach (var part in fasetParts)
                {
                    sb.AppendLine(String.Format("  fasets with {0} edges count: {1}", part.Key, part.Value));
                }

                textPlanarStatistics.Text = sb.ToString();
                
                #endregion

            }

        }

        //private void btnProcessUnfolding_Click(object sender, RoutedEventArgs e)
        //{
        //    this.Unfold(gumGraph);
        //    gumCanvas.DrawGraphToCanvas();
        //}


        #region прорисовка вершин:

        private Color GetVertexRenderColor(Physical2DGraphVertex vertex)
        {


            Color col = Colors.Lime;

            if (vertex is GUMNode)
            {
                NodeState state = (vertex as GUMNode).State;

                col = NodeStateHelper.GetVertexRenderColor(state);                
            }
            return col;
        }

        private Color GetVertexRenderTextColor(Physical2DGraphVertex vertex)
        {
            Color txtCol = Colors.White;


            if (vertex is GUMNode)
            {
                NodeState state = (vertex as GUMNode).State;

                txtCol = NodeStateHelper.GetVertexRenderTextColor(state);
                
            }

            return txtCol;
        }



        private void DoUpdateVertexRenderShape(Physical2DGraph.Physical2DGraphVertex vertex, Transform transform)
        {

            DrawingVisual dw = (DrawingVisual)vertex.visualForCanvasViewer;

            DrawingContext dc = dw.RenderOpen();

            Point position = transform.Transform(vertex.Position);










            //        if ((cb_ViewControl_DisplayVertexState != null) && (cb_ViewControl_DisplayVertexState.IsChecked.Value))
            //        {
            //            FormattedText formattedText = new FormattedText(
            //           gumn.State.ToString(),
            //           System.Globalization.CultureInfo.GetCultureInfo("en-us"),
            //           FlowDirection.LeftToRight,
            //           new Typeface("Verdana"),
            //           6 * nodeDisplayRadiusX,
            //           new SolidColorBrush(txtCol));

            if (vertex.Tag != null)
            {
                Color txtCol = GetVertexRenderTextColor(vertex);


                FormattedText formattedText = new FormattedText(
                vertex.Tag.ToString(),
                System.Globalization.CultureInfo.GetCultureInfo("en-us"),
                FlowDirection.LeftToRight,
                new Typeface("Verdana"),
                12,
                new SolidColorBrush(Colors.White));

                dc.DrawText(formattedText, new Point(position.X - 2 * gumCanvas.VertexDisplaySize.Width, position.Y - 2 * gumCanvas.VertexDisplaySize.Height));
                dc.DrawEllipse(new SolidColorBrush(GetVertexRenderColor(vertex)), null, position, 0.5 * gumCanvas.VertexDisplaySize.Width, 0.5 * gumCanvas.VertexDisplaySize.Height);

            }
            else
            {
                dc.DrawEllipse(new SolidColorBrush(GetVertexRenderColor(vertex)), null, position, 0.5 * gumCanvas.VertexDisplaySize.Width, 0.5 * gumCanvas.VertexDisplaySize.Height);
            }


            dc.Close();

        }



        #endregion


        #region прорисовка рёбер

        private void DoUpdateEdgeRenderShape(Physical2DGraphEdge<Physical2DGraph.Physical2DGraphVertex> edge, Transform transform)
        {


            Point DisplayPosition1 = transform.Transform(edge.Source.Position);
            Point DisplayPosition2 = transform.Transform(edge.Target.Position);

            DrawingVisual dw = (DrawingVisual)edge.visualForCanvasViewer;

            DrawingContext dc = dw.RenderOpen();

            // градиентная линия
            Color colSource = Colors.Lime;
            Color colTarget = Colors.Lime;

            if ((edge.Source is GUMNode) && (edge.Target is GUMNode))
            {
                GUMNode gumnSource = edge.Source as GUMNode;
                colSource = GetVertexRenderColor(gumnSource);

                GUMNode gumnTarget = edge.Target as GUMNode;
                colTarget = GetVertexRenderColor(gumnTarget);
            }

            Brush b;

            b = new SolidColorBrush(colSource);


            // наклонный прямоугольник
            dc.PushTransform(new RotateTransform((180 / Math.PI) * Math.Atan2((DisplayPosition2.Y - DisplayPosition1.Y), (DisplayPosition2.X - DisplayPosition1.X)), DisplayPosition1.X, DisplayPosition1.Y));
            dc.DrawRectangle(b, null, new Rect(DisplayPosition1.X, DisplayPosition1.Y - 0.5D * gumCanvas.EdgeDisplayThickness, Math.Sqrt((DisplayPosition2.X - DisplayPosition1.X) * (DisplayPosition2.X - DisplayPosition1.X) + (DisplayPosition2.Y - DisplayPosition1.Y) * (DisplayPosition2.Y - DisplayPosition1.Y)), gumCanvas.EdgeDisplayThickness));

            dc.Close();

        }



        #endregion


        private void UpdateControls()
        {
            if (gumGraph != null)
            {
                //btnCreateTestGraph.IsEnabled = false;

                if (btnDisplayGraphProperties != null) { btnDisplayGraphProperties.IsEnabled = true; }
                //if (btnUseAsFitnessAim != null) { btnUseAsFitnessAim.IsEnabled = true; }
            }

            // Для возможности запуска: должна быть выбрана фитнесс-функция. 
            // Для фитнесс-функии "Topology Sample" (index = 0) должен быть выбран пример
            // 
            if (((comboBox_FitnessFunctionType.SelectedIndex == 0) && (comboBox_Sample.SelectedIndex != -1))
                || (comboBox_FitnessFunctionType.SelectedIndex >= 0)
                )
            {
                //if (btnCalculateFitnessFunction != null) { btnCalculateFitnessFunction.IsEnabled = true; }
                btnStart.IsEnabled = true;
            }
            else
            {
                btnStart.IsEnabled = false;
            }

            if ((gumChromosome != null) && (UsingPlanarGraphFitnessFunction != null))
            {
                //btnDisplayFenotype.IsEnabled = true;
                btnSaveChangeTable.IsEnabled = true;
            }
        }





        private void btnSaveChangeTable_Click(object sender, RoutedEventArgs e)
        {
            ChangeTable changeTable = gumChromosome.GetChangeTable();

            double fitness;
            fitness = (gumChromosome as IChromosome).Fitness;

            Microsoft.Win32.SaveFileDialog dlg = new Microsoft.Win32.SaveFileDialog();
            dlg.Filter = "XAML (*.xaml)|*.xaml| All files (*.*)|*.*";
            dlg.FilterIndex = 0;
            dlg.FileName = String.Format("{0}_it_{1}_FF_{2}.xaml", System.IO.Path.GetFileNameWithoutExtension(loggingFileName), iterationCounterSaved, fitness);
            

            if (dlg.ShowDialog() == true)
            {
                try
                {
                    System.IO.FileStream stream = new FileStream(dlg.FileName, FileMode.Create);
                    System.Windows.Markup.XamlWriter.Save(changeTable, stream);
                    stream.Close();
                }
                catch (Exception ex)
                {
                    MessageBox.Show(this, ex.Message, "xamlWhriter.Save Error", MessageBoxButton.OK, MessageBoxImage.Error, MessageBoxResult.None);
                }
            }
        }

        /// <summary>
        /// Загрузка гена и заполнение им популяции
        /// </summary>
        /// <param name="sender"></param>
        /// <param name="e"></param>
        private void btnLoadChangeTable_Click(object sender, RoutedEventArgs e)
        {
            int chromosomeStartLength;
            int chromosomeMaxLength;

            try
            {
                chromosomeStartLength = Math.Max(0, int.Parse(tbChromosomeStartLength.Text));
                chromosomeMaxLength = 2 * chromosomeStartLength;
            }
            catch
            {
                chromosomeStartLength = 100;
                chromosomeMaxLength = 200;
            }


            if (MessageBox.Show("Fill the population by genom from file?", "Genom loading from file..", MessageBoxButton.OKCancel, MessageBoxImage.Question) == MessageBoxResult.OK)
            {
                Microsoft.Win32.OpenFileDialog dlg = new Microsoft.Win32.OpenFileDialog();
                dlg.Filter = "XAML (*.xaml)|*.xaml| All files (*.*)|*.*";
                if (dlg.ShowDialog() == true)
                {
                    ChangeTable changeTable;

                    try
                    {


                        // загружаем из файла:
                        System.IO.FileStream stream = new FileStream(dlg.FileName, FileMode.Open);
                        changeTable = (ChangeTable)System.Windows.Markup.XamlReader.Load(stream);
                        stream.Close();

                        // заполняем начальную популяцию загруженным "геном".

                        FillArgumentsFromControls(arguments);


                        GUMChromosome crhomosome = new GUMChromosome(changeTable.Count, chromosomeMaxLength, 
                                                                     arguments.geneticAlgorithmParametres.SingleActiveGenMutaionFactor, 
                                                                     arguments.geneticAlgorithmParametres.SingleActiveGenMutaionKind, 
                                                                     arguments.geneticAlgorithmParametres.SinglePassiveGenMutaionFactor,
                                                                     arguments.geneticAlgorithmParametres.SinglePassiveGenMutaionKind 
                                                                            );
                        crhomosome.SetChangeTable(changeTable);

                        if (evolutionResult == null)
                        {
                            // расчёт ещё ни разу не запускался:
                            evolutionResult = new EvolutionResult(crhomosome, new List<GUMChromosome>());
                        }
                        evolutionResult.Chromosomes.Clear();

                        UsingPlanarGraphFitnessFunction = CreateGraphFitnessFunctionFromGUI();
                        int stepsCount;
                        UsingPlanarGraphFitnessFunction.GrowGraph(crhomosome, out stepsCount);

                        GUMChromosome newChromosome;
                        for (int i = 0; i < arguments.populationSize; i++)
                        {
                            newChromosome = new GUMChromosome(crhomosome);
                            evolutionResult.Chromosomes.Add(new GUMChromosome(crhomosome));
                        }

                    }
                    catch (Exception ex)
                    {
                        MessageBox.Show(this, ex.Message, "xamlReader.Save Error", MessageBoxButton.OK, MessageBoxImage.Error, MessageBoxResult.None);
                    }




                }

            }


            //Microsoft.Win32.OpenFileDialog dlg = new Microsoft.Win32.OpenFileDialog();
            //dlg.Filter = "XAML (*.xaml)|*.xaml| All files (*.*)|*.*";
            //if (dlg.ShowDialog() == true)
            //{

            //    try
            //    {
            //        System.IO.FileStream stream = new FileStream(dlg.FileName, FileMode.Open);
            //        graphUnfoldingMachine.ChangeTable = (ChangeTable)System.Windows.Markup.XamlReader.Load(stream);
            //        stream.Close();
            //        DisplayChangeTable();
            //    }
            //    catch (Exception ex)
            //    {
            //        MessageBox.Show(this, ex.Message, "xamlReader.Save Error", MessageBoxButton.OK, MessageBoxImage.Error, MessageBoxResult.None);
            //    }
            //}

        }

        private void btnSaveGraph_Click(object sender, RoutedEventArgs e)
        {
            //Microsoft.Win32.SaveFileDialog dlg = new Microsoft.Win32.SaveFileDialog();
            //dlg.Filter = "XAML (*.xaml)|*.xaml| All files (*.*)|*.*";
            //dlg.FilterIndex = 0;
            //dlg.FileName = "Canvas.xaml";

            //if (dlg.ShowDialog() == true)
            //{

            //    DrawingGroup dvContainer = new DrawingGroup();
            //    DrawingContext dc = dvContainer.Append();


            //    for (int i = 0; i < customCanvas.Visuals.Count; i++)
            //    {
            //        DrawingVisual v = (DrawingVisual)customCanvas.Visuals[i];
            //        DrawingGroup dg = v.Drawing; // мы знаем, что там группа

            //        dc.DrawDrawing(v.Drawing);

            //        //for (int j = 0; j < dg.Children.Count; j++)
            //        //{
            //        //    dc.DrawDrawing(dg.Children[j]);
            //        //}
            //    }

            //    dc.Close();

            //    try
            //    {
            //        System.IO.FileStream stream = new FileStream(dlg.FileName, FileMode.Create);



            //        System.Windows.Markup.XamlWriter.Save(dvContainer, stream);
            //        stream.Close();
            //    }
            //    catch (Exception ex)
            //    {
            //        MessageBox.Show(this, ex.Message, "xamlWhriter.Save Error", MessageBoxButton.OK, MessageBoxImage.Error, MessageBoxResult.None);
            //    }
            //}

        }


        private void combo_ViewOptions_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {

        }

        private void btnScaleIn_Click(object sender, RoutedEventArgs e)
        {
            gumCanvas.Scale(2.0D);
        }

        private void btnScaleOut_Click(object sender, RoutedEventArgs e)
        {
            gumCanvas.Scale(0.5D);
        }

        private void comboBox_FitnessFunctionType_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            UpdateControls();
        }

        /// <summary>
        /// Выбор папки эксперимента - для сохранения логов , параметров, экземпляров
        /// </summary>
        /// <param name="sender"></param>
        /// <param name="e"></param>
        private void btnBrowseLoggingPath_Click(object sender, RoutedEventArgs e)
        {
            Microsoft.Win32.SaveFileDialog saveFileDialog = new Microsoft.Win32.SaveFileDialog();
            saveFileDialog.InitialDirectory = Properties.Settings.Default.ExperimentResultInitialDirectory;
            saveFileDialog.DefaultExt = "txt";
            

            saveFileDialog.Title = "Select path to logging results";
            if ((bool)saveFileDialog.ShowDialog() == true)
            {
                Properties.Settings.Default.ExperimentResultInitialDirectory = System.IO.Path.GetFullPath(saveFileDialog.FileName);
                loggingFileName = saveFileDialog.FileName;
            }


        }

        private void btnArrangeActiveGens_Click(object sender, RoutedEventArgs e)
        {

            if (evolutionResult != null)
            {
                foreach (GUMChromosome x in evolutionResult.Chromosomes)
                {
                    x.ArrangeActiveGens();
                }
            }
            
            
        }

    }
}
