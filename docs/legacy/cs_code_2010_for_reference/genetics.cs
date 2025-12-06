
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;
using QuickGraph;
using Physical2DGraph;
using GraphUnfoldingMachine;
using AForge;
using AForge.Genetic;


namespace GraphUnfoldingMachine.Genetic
{





    public class GUMChromosome : IChromosome
    {

        /// <summary>
        /// "Возраст" хромосомы
        /// </summary>
        int age = 0;
        //public int Age { get { return age; } }

        int maxAge = 10;
        private int mutationAvgStepLengh = 10; // TODO:параметризовать

        double singleActiveGenMutaionFactor = 0.1;
        MutationKind singleActiveGenMutaionKind = MutationKind.Byte;
        double singlePassiveGenMutaionFactor = 0.5;
        MutationKind singlePassiveGenMutaionKind = MutationKind.Byte;

        protected double fitness = 0;
        int maxLength;
        GumGen[] genes;

        protected bool isNeedToUpdateFitnessValue = true;
        public string activeGensScheme;
        public int activeGensCount;

        public void InvalidateFitnessValue()
        {
            isNeedToUpdateFitnessValue = true;
        }




        // random number generator for chromosomes generation
        //protected static ThreadSafeRandom rand = new ThreadSafeRandom((int)DateTime.Now.Ticks);
        //protected static Random rand = new Random((int)DateTime.Now.Ticks);



        double IChromosome.Fitness
        {
            get { return fitness; }

        }

        public GUMChromosome(
            int length,
            int maxLength,
            double singleActiveGenMutaionFactor,
            MutationKind singleActiveGenMutaionKind,
            double singlePassiveGenMutaionFactor,
            MutationKind singlePassiveGenMutaionKind
                            )
        {

            this.singleActiveGenMutaionFactor = singleActiveGenMutaionFactor;
            this.singleActiveGenMutaionKind = singleActiveGenMutaionKind;
            this.singlePassiveGenMutaionFactor = singlePassiveGenMutaionFactor;
            this.singlePassiveGenMutaionKind = singlePassiveGenMutaionKind;


            this.maxLength = maxLength;
            genes = new GumGen[length];
            for (int i = 0; i < length; i++)
            {
                genes[i] = new GumGen();
            }
            // save ancestor as a temporary head            
            // generate the chromosome
            Generate();

        }

        /// <summary>
        /// Clone constructor
        /// </summary>
        /// <param name="source"></param>
        /// <returns></returns>
        public GUMChromosome(GUMChromosome source)
        {
            // allocate genes array
            genes = new GumGen[source.genes.Length];
            fitness = source.fitness;

            // copy genes
            for (int i = 0; i < genes.Length; i++)
            {
                genes[i] = new GumGen(source.genes[i].GetValue());
                genes[i].WasActive = source.genes[i].WasActive;
            }

            // копируем поля
            maxLength = source.maxLength;
            age = source.age;
            singleActiveGenMutaionFactor = source.singleActiveGenMutaionFactor;
            singleActiveGenMutaionKind = source.singleActiveGenMutaionKind;
            singlePassiveGenMutaionFactor = source.singlePassiveGenMutaionFactor;
            singlePassiveGenMutaionKind = source.singlePassiveGenMutaionKind;
        }

        public void SetGAParametres(GAParametres parametres)
        {
            singleActiveGenMutaionFactor = parametres.SingleActiveGenMutaionFactor;
            singleActiveGenMutaionKind = parametres.SingleActiveGenMutaionKind;
            singlePassiveGenMutaionFactor = parametres.SinglePassiveGenMutaionFactor;
            singlePassiveGenMutaionKind = parametres.SinglePassiveGenMutaionKind;

        }

        public GUMChromosome(ChangeTable changeTable)
        {


            this.maxLength = changeTable.Count * 2;

            SetChangeTable(changeTable);
        }

        public int Age()
        {
            return age;
        }

        IChromosome IChromosome.Clone()
        {
            return new GUMChromosome(this);

        }

        IChromosome IChromosome.Born()
        {
            GUMChromosome result = new GUMChromosome(this);
            this.age++;
            result.age = 0;
            return result;

        }

        IChromosome IChromosome.CreateOffspring()
        {
            GUMChromosome result = new GUMChromosome(this);//.genes.Length, maxLength);
            if (RandomGen3.NextDouble() < 0.9)
            {
                (result as IChromosome).Mutate();
            }
            return result;
        }

        void IChromosome.Crossover(IChromosome pair)
        {
            //age++;
            //((GUMChromosome)pair).age++;
            // 1. в процессе кроссинговера - изменяется длина хромосомы. Может становиться меньше или больше.
            // 2. длины хромосом могут быть разными

            GumGen[] pairGens = ((GUMChromosome)pair).genes;

            int L1 = this.genes.Length;
            int L2 = pairGens.Length;
            int crossOverPoint1 = RandomGen3.Next(L1 - 1) + 1;
            int crossOverPoint2;

            bool Symmetric = false;
            if (Symmetric)
            {
                crossOverPoint2 = crossOverPoint1;
            }
            else
            {
                crossOverPoint2 = RandomGen3.Next(L2 - 1) + 1;
            }


            // новые последовательности генов, после кроссинга:
            // ген1 от 0 до crossOverPoint1 содержит элементы из this.gens (от 0 до crossOverPoint1), а после - элементы из pair.gens от crossOverPoint2  до L2)
            int newL1 = Math.Min(maxLength, crossOverPoint1 + L2 - crossOverPoint2);
            int newL2 = Math.Min(maxLength, crossOverPoint2 + L1 - crossOverPoint1);

            GumGen[] genes1 = new GumGen[newL1];
            GumGen[] genes2 = new GumGen[newL2];



            Array.Copy(this.genes, 0, genes1, 0, crossOverPoint1);
            Array.Copy(pairGens, crossOverPoint2, genes1, crossOverPoint1, newL1 - crossOverPoint1);

            Array.Copy(pairGens, 0, genes2, 0, crossOverPoint2);
            Array.Copy(this.genes, crossOverPoint1, genes2, crossOverPoint2, newL2 - crossOverPoint2);

            this.genes = genes1;
            ((GUMChromosome)pair).genes = genes2;

            this.isNeedToUpdateFitnessValue = true;
            ((GUMChromosome)pair).isNeedToUpdateFitnessValue = true;

        }

        void IChromosome.Evaluate(IFitnessFunction function)
        {
            //if ((isNeedToUpdateFitnessValue) /*|| (age > maxAge)*/)
            //{
            //    /*if (age <= maxAge)
            //    {
            //     */

            fitness = function.Evaluate(this);
            isNeedToUpdateFitnessValue = false;
            //    /*}
            //    else
            //    {

            //        fitness = double.MinValue;
            //    }*/
            //}
        }

        public virtual void Generate()
        {
            foreach (GumGen gen in genes)
            {
                GenerateGen(gen);
            }

            isNeedToUpdateFitnessValue = true;
        }

        private static void GenerateGen(GumGen gen)
        {
            byte[] bytes = new byte[8];

            RandomGen3.NextBytes(bytes);
            ulong lng = BitConverter.ToUInt64(bytes, 0);

            gen.SetValue(lng);


        }



        private static void MutateGen(GumGen gen, MutationKind mutationKind)
        {
            //byte[] bytes = new byte[8];

            //rand.NextBytes(bytes);
            //ulong lng = BitConverter.ToUInt64(bytes, 0);




            switch (mutationKind)
            {
                case MutationKind.Bit:
                    // изменяем только один бИт - часть гена
                    #region
                    {
                        ulong lng = gen.GetValue();


                        lng ^= ((ulong)1 << RandomGen3.Next(64));
                        lng ^= ((ulong)1 << RandomGen3.Next(64));
                        lng ^= ((ulong)1 << RandomGen3.Next(64));
                        lng ^= ((ulong)1 << RandomGen3.Next(64));

                        gen.SetValue(lng);
                    }
                    #endregion
                    break;
                case MutationKind.Byte:

                    // изменяем только один байт - часть гена
                    #region

                    {
                        byte[] bytes = new byte[8];

                        RandomGen3.NextBytes(bytes);
                        ulong lng = BitConverter.ToUInt64(bytes, 0);

                        ulong lngPrior = gen.GetValue();
                        ulong mask = 0x0000000000000000;
                        ulong maskNot = 0xFFFFFFFFFFFFFFFF;

                        switch (RandomGen3.Next(0, 7))
                        {
                            case 0:
                                mask = 0x00000000000000FF;
                                maskNot = 0xFFFFFFFFFFFFFF00;
                                break;

                            case 1:
                                mask = 0x000000000000FF00;
                                maskNot = 0xFFFFFFFFFFFF00FF;
                                break;

                            case 2:
                                mask = 0x0000000000FF0000;
                                maskNot = 0xFFFFFFFFFF00FFFF;
                                break;
                            case 3:
                                mask = 0x00000000FF000000;
                                maskNot = 0xFFFFFFFF00FFFFFF;
                                break;

                            case 4:
                                mask = 0x000000FF00000000;
                                maskNot = 0xFFFFFF00FFFFFFFF;
                                break;
                            case 5:
                                mask = 0x0000FF0000000000;
                                maskNot = 0xFFFF00FFFFFFFFFF;
                                break;
                            case 6:
                                mask = 0x00FF000000000000;
                                maskNot = 0xFF00FFFFFFFFFFFF;
                                break;
                            case 7:
                                mask = 0xFF00000000000000;
                                maskNot = 0x00FFFFFFFFFFFFFF;
                                break;

                        }


                        gen.SetValue((lng & maskNot) | (mask & lng));
                    }
                    #endregion
                    break;
                case MutationKind.AllBytes:
                    // изменяем только один байт - часть гена
                    #region

                    {
                        byte[] bytes = new byte[8];

                        RandomGen3.NextBytes(bytes);
                        ulong lng = BitConverter.ToUInt64(bytes, 0);


                        gen.SetValue(lng);
                    }
                    #endregion
                    break;
                case MutationKind.Shift:
                    // сдвигаем
                    #region
                    {
                        ulong lng = gen.GetValue();
                        lng = (lng << 8) + (lng >> 56);                        
                        gen.SetValue(lng);                        
                    }
                    break;
                    #endregion

                default:
                    break;
            }





        }



        void IChromosome.Mutate()
        {


            if ((singleActiveGenMutaionFactor == singlePassiveGenMutaionFactor) && (singleActiveGenMutaionKind == singlePassiveGenMutaionKind))
            {
                // Если без разницы активность генов:
                for (int i = 0; i < genes.Length; i++)
                {
                    if (RandomGen3.NextDouble() < singleActiveGenMutaionFactor)
                    {
                        GUMChromosome.MutateGen(genes[i], singleActiveGenMutaionKind);
                    }
                }

            }
            else
            {
                // Если тип и вероятность мутации зависят от активности генов:

                int activeGensCount = 0;
                for (int i = 0; i < genes.Length; i++)
                {
                                        
                    if (genes[i].WasActive)
                    {
                        activeGensCount++;
                        if (RandomGen3.NextDouble() < singleActiveGenMutaionFactor)
                        {
                            GUMChromosome.MutateGen(genes[i], singleActiveGenMutaionKind);
                        }

                        if (RandomGen3.NextDouble() < singleActiveGenMutaionFactor*0.2)
                        {
                            GUMChromosome.MutateGen(genes[i], MutationKind.Shift);
                        }
                    }
                    else
                    {
                        if (RandomGen3.NextDouble() < singlePassiveGenMutaionFactor)
                        {
                            GUMChromosome.MutateGen(genes[i], singlePassiveGenMutaionKind);
                        }

                        if (RandomGen3.NextDouble() < singlePassiveGenMutaionFactor * 0.2)
                        {
                            GUMChromosome.MutateGen(genes[i], MutationKind.Shift);
                        }
                    }

                }

                // черновик: Случайная "вставка" активного гена

                

                if (RandomGen3.NextDouble() < 0.1)
                {
                    if ((genes.Length < maxLength) && (activeGensCount > 1))
                    {
                        GumGen[] genes1 = new GumGen[genes.Length + 1];
                        // находим случайный индекс активного гена:
                        int rndActiveNumberForInsertion = RandomGen3.Next(1, activeGensCount);
                        int activeGenIndex = -1;
                        int activeGenPassedCount = 0;
                        while (activeGenPassedCount < rndActiveNumberForInsertion)
                        {
                            activeGenIndex++;
                            if (genes[activeGenIndex].WasActive) { activeGenPassedCount++; };

                        }

                        Array.Copy(genes, 0, genes1, 0, activeGenIndex + 1);
                        Array.Copy(genes, activeGenIndex, genes1, activeGenIndex + 1, 1);
                        if (genes.Length - activeGenIndex - 1 > 0)
                        {
                            Array.Copy(genes, activeGenIndex + 1, genes1, activeGenIndex + 2, genes.Length - activeGenIndex - 1);
                        }

                        //this.genes = genes1;
                    }
                };

                if (RandomGen3.NextDouble() < 0.1)
                {

                    // удаляем первый попавшийся неактивный ген, если есть

                    if ((activeGensCount < genes.Length) &&  (genes.Length >= 100))
                    {
                        int rndInActiveNumberForInsertion = RandomGen3.Next(1, genes.Length - activeGensCount);

                        int inactiveGenIndex = -1;
                        int inactiveGenPassedCount = 0;
                        while (inactiveGenPassedCount < rndInActiveNumberForInsertion)
                        {
                            inactiveGenIndex++;
                            if (!genes[inactiveGenIndex].WasActive) { inactiveGenPassedCount++; };

                        }

                        if ((inactiveGenIndex < genes.Length) && (inactiveGenIndex > 0))
                        {
                            GumGen[] genes1 = new GumGen[genes.Length - 1];
                            //Array.Copy(genes, genes1, genes.Length - 1);
                            Array.Copy(genes, 0, genes1, 0, inactiveGenIndex);
                            Array.Copy(genes, inactiveGenIndex + 1, genes1, inactiveGenIndex, genes.Length - 1 - inactiveGenIndex);

                            this.genes = genes1;
                        }

                    }


                };

                //}



               
                
                

            }


            // дублирование первого гена
            if (RandomGen3.NextDouble() < 0.2)
            {
                if ((genes.Length < maxLength))
                {
                    GumGen[] genes1 = new GumGen[genes.Length + 1];

                    Array.Copy(genes, 0, genes1, 0, 1);
                    Array.Copy(genes, 0, genes1, 1, genes.Length);

                  

                    this.genes = genes1;
                }
            };


            isNeedToUpdateFitnessValue = true;

        }

        public void ArrangeActiveGens()
        {
           
            int activeGenCount = genes.Count(s => s.WasActive);
            GumGen[] arrangegGenes = new GumGen[genes.Length];
            int activeIdx = 0; // индекс, перемещающийся по активным генам в исходном массиве
            int nonactiveIdx= 0; // индекс, перемещающийся по неактивным генам в исходном массиве            
            
            double ratio  = (double)activeGenCount/genes.Length;

           for (int resultIdx = 0; resultIdx < genes.Length; resultIdx++)
			{
               int curValue =  (int)Math.Floor((resultIdx)*ratio);
               int nextValue =  (int)Math.Floor((resultIdx+1)*ratio);
               bool isFound = false;

               if (nextValue > curValue)
               {
                   // на месте resultIdx должен быть активный ген
                   while (!isFound && activeIdx < genes.Length)
                   {
                       if (genes[activeIdx].WasActive)
                       {
                           isFound = true;
                           Array.Copy(genes, activeIdx, arrangegGenes, resultIdx, 1);
                       }
                       activeIdx++;
                   }
                   
                   
               }
               else
               {
                    // на позиции resultIdx должен быть неактивный ген
                   // на месте resultIdx должен быть активный ген
                   while (!isFound && nonactiveIdx < genes.Length)
                   {
                       if (!genes[nonactiveIdx].WasActive)
                       {
                           isFound = true;
                           Array.Copy(genes, nonactiveIdx, arrangegGenes, resultIdx, 1);
                           // "выключаем" неактиный ген
                           arrangegGenes[resultIdx].Connections_LE = 0;
                           arrangegGenes[resultIdx].Connections_GE = 1;
                           arrangegGenes[resultIdx].OperationType = 0; // turn to state
                           arrangegGenes[resultIdx].OperandStatus = arrangegGenes[resultIdx].Status;

                       }
                       nonactiveIdx++;
                   }
               }
                
			}

           if (arrangegGenes[arrangegGenes.Length - 1] == null)
           {
               Array.Copy(genes, arrangegGenes.Length - 1, arrangegGenes, arrangegGenes.Length - 1, 1);
           }

           this.genes = arrangegGenes;


            

        }

        public void SetActiveGensMask(System.Collections.BitArray activeGensBitArray)
        {
            //this.activeGensBitArray = activeGensBitArray;
            for (int i = 0; i < genes.Count(); i++)
            {
                genes[i].WasActive = activeGensBitArray[i];
            }
        }

        int IComparable.CompareTo(object obj)
        {
            double f = ((GUMChromosome)obj).fitness;
            int result;

            if (fitness == f)
            {
                GUMChromosome other = (GUMChromosome)obj;
                result = (this.age == other.age) ? 0 : (this.age > other.age) ? 1 : -1;
            }
            else
            {
                result = (fitness < f) ? 1 : -1; // в порядке убывания fitness
            }

            return result;

        }

        public ChangeTable GetChangeTable()
        {
            ChangeTable result = new ChangeTable();
            foreach (GumGen gen in genes)
            {
                result.Add(gen.ToChangeTableItem());
            }

            return result;
        }

        public void SetChangeTable(ChangeTable changeTable)
        {
            

            genes = new GumGen[changeTable.Count];
            for (int i = 0; i < changeTable.Count; i++)
            {
                genes[i] = new GumGen();
                genes[i].Status = (byte)changeTable[i].Condition.CurrentState;
                genes[i].PriorStatus = (byte)changeTable[i].Condition.PriorState;
                genes[i].Connections_GE = (byte)changeTable[i].Condition.AllConnectionsCount_GE;
                genes[i].Connections_LE = (byte)changeTable[i].Condition.AllConnectionsCount_LE;
                genes[i].Parents_GE = (byte)changeTable[i].Condition.ParentsCount_GE;
                genes[i].Parents_LE = (byte)changeTable[i].Condition.ParentsCount_LE;

                genes[i].OperationType = (byte)changeTable[i].Operation.Kind;
                genes[i].OperandStatus = (byte)changeTable[i].Operation.OperandNodeState;
                genes[i].WasActive = changeTable[i].WasActive;


            }
            // save ancestor as a temporary head            
            // generate the chromosome

        }



        public int Length { get { return genes.Length; } }
    }


    public abstract class PlanarGraphFitnessFunction : IFitnessFunction
    {

        // параметры фитнесс функции        
        protected int maxVertexCount;
        protected int maxGUCAIterationCount;
        protected bool isGenomeLengthPenalty;
        protected bool isNotPlannedPenalty;
        protected NumericalMethodParametres unfoldingParametres;
        private TranscriptionWay transcriptionWay;
        //protected  int MaxGUCAIterationCount { get { return maxGUCAIterationCount; } }


        /// <summary>
        /// Фитнес-функция планарного графа. Чем ближе статистика графа к статистике, переданной
        /// </summary>
        /// <param name="fasetsDistributionByLength">целевое распределение граней по их длине, в виде массива пар "Key, Value". 
        /// Key - длина грани, Value - количество граней с такой длиной</param>
        /// <param name="verticesDistributionByDegree">целевое распределение узлов графа по их степени в виде пар "Key, Value".
        ///  Key - степень узла, Value - количество узлов в графе с такой степенью-</param>
        public PlanarGraphFitnessFunction(
                                            int maxGUCAIterationCount,
                                            int maxVertexCount,
                                            bool isGenomeLengthPenalty,
                                            bool isNotPlannedPenalty,
                                            NumericalMethodParametres unfoldingParametres,
                                            TranscriptionWay transcriptionWay

            //,
            //                                int Physical2
            //                                Physical2DGraphUnfoldinParametres

                                           )
        {
            this.maxGUCAIterationCount = maxGUCAIterationCount;
            this.maxVertexCount = maxVertexCount;
            this.isGenomeLengthPenalty = isGenomeLengthPenalty;
            this.isNotPlannedPenalty = isNotPlannedPenalty;
            this.unfoldingParametres = unfoldingParametres;
            this.transcriptionWay = transcriptionWay;
        }

        /// <summary>
        /// Расчёт фитнесс функции хромосомы
        /// </summary>
        /// <param name="chromosome"></param>
        /// <returns></returns>
        double IFitnessFunction.Evaluate(IChromosome chromosome)
        {
            // Разворачиваем граф из хромосомы (выращиваем фенотип) 
            // и расчитываем фитнес-функцию фенотипа

            double result;
            int stepsPassed;
            Physical2DGraph.Physical2DGraph graph = GrowGraph(chromosome, out stepsPassed);



            // Фильтр на планарность, минимальный размер графа и т.п.:
            result = this.EvaluateCommonFilter(graph, stepsPassed);

            // Основной расчёт ФФ
            if (result == 1.0)
            {
                result = this.Evaluate(graph);// +1.0 / (((chromosome as GUMChromosome).Length));
            }


            // Надвавка за краткость хромосомы:
            if (isGenomeLengthPenalty)
            {
                result = result + 1.0 / (((chromosome as GUMChromosome).Length));
            }
            return result;
        }

        /// <summary>
        /// Для фильтрации минимально жизнеспособных экземпляров (должны содеражать более одного узла, быть планарными и т.п.)
        /// </summary>
        /// <param name="graph"></param>
        /// <param name="stepsPassed"></param>
        /// <returns>Возвращает результат от 0 до 1. Остальная область значений фитнесс функции - от 1.0 до бесконечности </returns>
        private double EvaluateCommonFilter(Physical2DGraph.Physical2DGraph graph, int stepsPassed)
        {
            // граф не должен состояить из одного узла ("мёртворождённый")
            if (graph.VertexCount == 1)
            {
                return 0;
            };

            // граф не должен быть слишком велик
            if ((graph.VertexCount >= maxVertexCount))
            {
                return 0.1;
            }

            // Процесс развёртывания графа его рост не должен быть бесконечным:

            if (stepsPassed >= maxGUCAIterationCount - 2)
            {
                return 0.9;
            }








            bool isPlanar = graph.Planarize();


            if (!isPlanar)
            {
                return 0.3;
            }


            return 1.0;


        }

        /// <summary>
        /// Выращивание феннотипа из генотипа (их хромосомы выращиаваем граф)
        /// </summary>
        /// <param name="chromosome"></param>
        /// <returns></returns>
        public Physical2DGraph.Physical2DGraph GrowGraph(IChromosome chromosome, out int stepsPassed)
        {

            GUMGraph gumGraph = new GUMGraph();
            gumGraph.AddVertex(new GUMNode(NodeState.A));
            gumGraph.MaxVerticesCount = maxVertexCount;
            gumGraph.MaxConnectionCount = 6;

            GraphUnfoldingMachine graphUnfoldingMachine = new GraphUnfoldingMachine(gumGraph);

            graphUnfoldingMachine.MaxStepsCount = maxGUCAIterationCount;
            graphUnfoldingMachine.Support1Connected = true;
            graphUnfoldingMachine.TranscriptionWay = this.transcriptionWay;

            graphUnfoldingMachine.ChangeTable = TranslateNative(chromosome);
            graphUnfoldingMachine.Reset();
            graphUnfoldingMachine.Run();





            #region Заполняем схему активности генов
            int activeGensCount = 0;
            bool priorGenIsActive = false;

            int counter = 0;

            if (graphUnfoldingMachine.ChangeTable.Count > 0)
            {
                priorGenIsActive = graphUnfoldingMachine.ChangeTable[0].WasActive;
            }



            StringBuilder sb = new StringBuilder();

            foreach (var chi in graphUnfoldingMachine.ChangeTable)
            {
                if (chi.WasActive)
                {
                    activeGensCount++;

                }

                if (chi.WasActive)
                {
                    if (!priorGenIsActive)
                    {
                        sb.Append(counter);
                    }

                    sb.Append("x");

                    counter = 1;
                }
                else
                {

                    counter++;
                }

                priorGenIsActive = chi.WasActive;

                //// Если продолжается тот же статус гена - то просто наращиваем счётчик
                //if (chi.WasActive == priorGenIsActive)
                //{
                //    counter++;
                //}
                //else
                //{
                //    // если в последовательности статус активности изменился, то фиксируем количество предыдущих
                //    // генов последовательных в одном и тот же статусе активности
                //    sb.AppendFormat(priorGenIsActive ? "x" : "o{0}", counter );
                //    priorGenIsActive = chi.WasActive;
                //    counter = 1;

                //}
            }

            if (!priorGenIsActive)
            {
                sb.Append(counter);
            }


            stepsPassed = graphUnfoldingMachine.PassedStepsCount;

            (chromosome as GUMChromosome).activeGensScheme = sb.ToString();
            (chromosome as GUMChromosome).activeGensCount = activeGensCount;

            #endregion

            #region Заполняем и передаём хромосоме карту активности битовой строки
            System.Collections.BitArray activeGensBitArray = new System.Collections.BitArray(graphUnfoldingMachine.ChangeTable.Count, false);

            for (int i = 0; i < graphUnfoldingMachine.ChangeTable.Count; i++)
            {
                if (graphUnfoldingMachine.ChangeTable[i].WasActive)
                {
                    activeGensBitArray[i] = true;
                }
            }


            chromosome.SetActiveGensMask(activeGensBitArray);
            #endregion

            return graphUnfoldingMachine.Graph;
        }

        /// <summary>
        /// Расчёт фитнесс функций фенотипа (выращеного графа)
        /// </summary>
        /// <param name="graph"></param>
        /// <returns>Должна возвращать результат в диапазоне от 1.0 до бесконечности </returns>
        public abstract double Evaluate(Physical2DGraph.Physical2DGraph graph);
        #region OLD
        //{

        ////// Сарая, общая версия

        //#region  Расчитываем фитнес функцию полученного графа


        //// 1. Находим распределение узлов по степеням и граней по длине  получившегося графа
        ////bool isPlanar;

        ////List<Cycle<Physical2DGraphVertex>> fasets = graph.Planarize(out isPlanar);
        ////Dictionary<int, int> curFasetsDistributionByLength = this.GetFasetsDistributionByLength(fasets);
        ////Dictionary<int, int> curVerticesDistributionByDegree = this.GetVerticiesDistributionByDegree(graph);

        ////// 2.Расчитываем дистанцию между целевым распределением узлов по степеням и распределением получившегося графа
        ////var vertUnion = (from x in curVerticesDistributionByDegree
        ////                 select new
        ////                 {
        ////                     Key = x.Key,
        ////                     Value = -x.Value
        ////                 }).Union
        ////                    (from y in this.verticesDistributionByDegree
        ////                     select new
        ////                     {
        ////                         Key = y.Key,
        ////                         Value = y.Value
        ////                     }
        ////                    );


        ////var vertGroupedSum =
        ////        from x in vertUnion
        ////        group x by x.Key into g
        ////        select new { g.Key, KeySum = g.Sum(x => x.Value) };

        ////int vertDistance = vertGroupedSum.Sum(x => Math.Abs(x.KeySum));

        ////// 3.Расчитываем дистанцию между целевым распределением граней по длине и распределением получившегося графа
        ////var fasetsUnion = (from x in curFasetsDistributionByLength
        ////                   select new
        ////                   {
        ////                       Key = x.Key,
        ////                       Value = -x.Value
        ////                   }).Union
        ////                   (from y in fasetsDistributionByLength
        ////                    select new
        ////                    {
        ////                        Key = y.Key,
        ////                        Value = y.Value
        ////                    }
        ////                   );

        ////int fasetDistance =
        ////        (from x in fasetsUnion
        ////         group x by x.Key into g
        ////         select new { g.Key, KeySum = g.Sum(x => x.Value) })
        ////        .Sum(x => Math.Abs(x.KeySum));


        ////// 4. чем больше дистанция, тем менее пригоден к жизни получившийся граф:
        ////// 1-ый приоритет: количество граней.
        ////double result = Math.Abs(fasetsDistributionByLength.Sum(x => x.Value) - curFasetsDistributionByLength.Sum(x => x.Value));
        //////result =  - result*100 - 10*fasetDistance - vertDistance;

        //double result = -101;



        //// граф не должен состояить из одного узла ("мёртворождённый")
        //if (graph.VertexCount == 1)
        //{
        //    result = -100;
        //}
        //else
        //{

        //    // граф не должен быть слишком велик
        //    if ((graph.VertexCount >= maxNodesCount))
        //    {
        //        result = -99.0;
        //    }
        //    else
        //    {
        //        // Процесс развёртывания графа не должен быть бесконечным:
        //        if (stepsPassed >= unfoldingMaxStepsCount - 2)
        //        {
        //            result = -98.0;
        //        }
        //        else
        //        {

        //            bool isPlanar;
        //            List<Cycle<Physical2DGraphVertex>> fasets = graph.Planarize(out isPlanar);

        //            // Граф должен быть планарным и не "деревянным"

        //            if ((fasets.Count <= 1) || (isPlanar == false))
        //            {
        //                result = -97.0;
        //            }
        //            else
        //            {
        //                //!!! Для "производства" сетки:
        //                //Минимальная длина цикла должна быть больше 
        //                int MinCycleLength = fasets.Min(x => x.MinCycleLength);

        //                // целевой размер ячейки сетки: 
        //                int AimMeshCycleLength = 6;
        //                // целевая связность узла сетки:
        //                int AimVertexDegree = (AimMeshCycleLength == 4) ? 4 : (AimMeshCycleLength == 3) ? 6 : 3;


        //                //if ((MinCycleLength < AimMeshCycleLength) && (graph.VertexCount <= 10))
        //                //{
        //                //    if (MinCycleLength < 4)
        //                //    {
        //                //        result = -96.0;
        //                //    }
        //                //    else if (MinCycleLength < 5)
        //                //    {
        //                //        result = -95;
        //                //    }
        //                //    else if (MinCycleLength < 6)
        //                //    {
        //                //        result = -94;
        //                //    }

        //                //}
        //                //else
        //                {
        //                    // дополнительные ограничения
        //                    bool isTopologyFilter = true;


        //                    if (isTopologyFilter)
        //                    {
        //                        isTopologyFilter = graph.IsBeconnected();
        //                    }

        //                    // проверка на уложенность графа на плоскости:
        //                    if (isTopologyFilter && checkIsPlanned)
        //                    {
        //                        graph.Unfold(new Point(0, 0));
        //                        isTopologyFilter = graph.IsPlanned();
        //                    };


        //                    if (!isTopologyFilter)
        //                    {
        //                        result = -90.0;
        //                        return result;
        //                    }
        //                    else
        //                    {




        //                        // максимальное колво связей у вершины не должно превышать 5-ти
        //                        int MaxVertexDegree = graph.Vertices.Max(x => graph.AdjacentDegree(x));
        //                        //int MinVertexDegree = graph.Vertices.Min(x => graph.AdjacentDegree(x));
        //                        //int MaxVertexDegreeInMaxCyle = (from f in fasets orderby f.MinCycleLength() descending select f).First().Vertices.Max(x => graph.AdjacentDegree(x));

        //                        if (MaxVertexDegree > 4) // для Hex + 3 /*|| MaxVertexDegreeInMaxCyle > 3 /*|| MinVertexDegree < 2*/)
        //                        {
        //                            result = -89.0;
        //                        }
        //                        else
        //                        {

        //                            //Dictionary<int, int> curFasetsDistributionByLength = this.GetFasetsDistributionByLength(fasets);
        //                            //Dictionary<int, int> curVerticesDistributionByDegree = this.GetVerticiesDistributionByDegree(graph);
        //                            //curFasetsLength = new List<int>();

        //                            // Найдём "топологическое" расстояние между графами, используя меры "степень вершин", "длина граней"
        //                            // сумируя разницу между попарно наиболее близкими гранями или вершинами.

        //                            // для каждой грани из текущего графа ищем грань из целевого графа ближайшую по длине. Разницу между длинами суммируем.
        //                            // если в текущем графе остаются грани, а в целевом графе уже закончились

        //                            #region Обобщённый алгоритм сравнения топологий:
        //                            /*
        //                        #region Вычисляем дистанцию по фасеткам

        //                        // заполняем список длин фасеток целевого графа
        //                        List<int> aimFasetsLength = new List<int>();
        //                        foreach (KeyValuePair<int, int> pair in fasetsDistributionByLength)
        //                        {
        //                            for (int i = 0; i < pair.Value; i++)
        //                            {
        //                                aimFasetsLength.Add(pair.Key);
        //                            }
        //                        };
        //                        aimFasetsLength.Sort();

        //                        // -- заполняем список длин фасеток текущего графа
        //                        List<int> curFasetsLength = (from f in fasets select f.MinCycleLength).ToList<int>();
        //                        int aimLength = (from x in fasetsDistributionByLength select x).Sum(x => x.Value);

        //                        // Если в текущем графе меньше фасеток чем в целевом, то добавлем
        //                        if (aimLength > curFasetsLength.Count)
        //                        {
        //                            for (int i = curFasetsLength.Count; i < aimLength; i++)
        //                            {
        //                                curFasetsLength.Add(0);
        //                            }
        //                        }




        //                        // Рассчитываем сумму
        //                        double fasetDistance = 0;

        //                        #region удаляем полные совпадения

        //                        List<int> toDelete = new List<int>();
        //                        toDelete.Clear();

        //                        foreach (int fl in curFasetsLength)
        //                        {
        //                            // удаляем полные совпадения
        //                            if (aimFasetsLength.Contains(fl))
        //                            {
        //                                toDelete.Add(fl);
        //                                aimFasetsLength.Remove(fl);
        //                            }
        //                        }

        //                        foreach (int i in toDelete)
        //                        {
        //                            curFasetsLength.Remove(i);
        //                        }

        //                        #endregion

        //                        foreach (int fl in curFasetsLength.OrderBy(x => x))
        //                        {
        //                            // находим ближайшую по длине целевую фасетку
        //                            int aimFL = (from x in aimFasetsLength
        //                                         orderby Math.Abs(x - fl)
        //                                         select x).FirstOrDefault();

        //                            fasetDistance = fasetDistance + Math.Abs(aimFL - fl);
        //                            // удаляем фасетку как рассмотренную 
        //                            aimFasetsLength.Remove(aimFL);
        //                        }

        //                        #endregion

        //                        #region вычисляем дистанцию по вершинам

        //                        // заполняем список степеней вершин целевого графа
        //                        List<int> aimVertexDegree = new List<int>();
        //                        foreach (KeyValuePair<int, int> pair in verticesDistributionByDegree)
        //                        {
        //                            for (int i = 0; i < pair.Value; i++)
        //                            {
        //                                aimVertexDegree.Add(pair.Key);
        //                            }
        //                        };
        //                        aimVertexDegree.Sort();

        //                        // -- заполняем список степеней вершин текущего графа
        //                        List<int> curVertexLength = (from v in graph.Vertices select graph.AdjacentDegree(v)).ToList<int>();

        //                        int vertAimLengthSum = (from x in verticesDistributionByDegree select x).Sum(x => x.Value);

        //                        // Если в текущем графе меньше вершин чем в целевом, то добавлем
        //                        if (vertAimLengthSum > curVertexLength.Count)
        //                        {
        //                            for (int i = curVertexLength.Count; i < vertAimLengthSum; i++)
        //                            {
        //                                curVertexLength.Add(0);
        //                            }
        //                        }


        //                        //List<int> toDelete = new List<int>();
        //                        toDelete.Clear();

        //                        foreach (int fl in curVertexLength)
        //                        {
        //                            // удаляем полные совпадения
        //                            if (aimVertexDegree.Contains(fl))
        //                            {
        //                                toDelete.Add(fl);
        //                                aimVertexDegree.Remove(fl);
        //                            }
        //                        }

        //                        foreach (int i in toDelete)
        //                        {
        //                            curVertexLength.Remove(i);
        //                        }



        //                        // Рассчитываем сумму
        //                        double vertivesDistance = 0;

        //                        foreach (int fl in curVertexLength.OrderByDescending(x => x))
        //                        {
        //                            // находим ближайшую по длине целевую фасетку
        //                            int aimFL = (from x in aimVertexDegree
        //                                         orderby Math.Abs(x - fl)
        //                                         select x).FirstOrDefault();

        //                            vertivesDistance = vertivesDistance + Math.Abs(aimFL - fl);
        //                            // удаляем фасетку как рассмотренную 
        //                            aimVertexDegree.Remove(aimFL);
        //                        }

        //                        #endregion
        //                        */
        //                            #endregion


        //                            //  сетка
        //                            double aimFasetsCount = (from f in fasets where f.MinCycleLength == AimMeshCycleLength select f).Count();

        //                            //double wellConnectedVertexCount = (double)(from x in graph.Vertices w).Count();
        //                            double wellConnectedVertexCount = graph.VertexCount;// (double)graph.Vertices.Where(x => x.ConnectionsCount > 1).Count();
        //                            double aimVertexCount = (double)graph.Vertices.Where(x => x.ConnectionsCount == AimVertexDegree).Count();

        //                            int MaxCycleLength = fasets.Max(x => x.MinCycleLength);
        //                            // для кольца - исключаем внешний цикл
        //                            if (MaxCycleLength == AimMeshCycleLength) { aimFasetsCount = aimFasetsCount - 1; };

        //                            // доля фасеток к количеству фасеток и узлов - макс и количество фасеток - побольше.

        //                            #region Hex
        //                            // Hex
        //                            //result = -10.0 * (0.5 - ((double)aimFasetsCount + 0.5 * Fasets5Count + 0.3 * Fasets4Count + 0.2*Fasets3Count) / (double)graph.Vertices.Count()

        //                            //) 
        //                            //        - 8.0 + 0.5*(double)aimFasetsCount; // -0.33 * vertivesDistance - fasetDistance - (fasets4Count
        //                            double Fasets3Count = (from f in fasets where f.MinCycleLength == 3 select f).Count();

        //                            double Fasets4Count = (from f in fasets where f.MinCycleLength == 4 select f).Count();
        //                            if (MaxCycleLength == 4) { Fasets4Count = Fasets4Count - 1; };

        //                            double Fasets5Count = (from f in fasets where f.MinCycleLength == 5 select f).Count();
        //                            if (MaxCycleLength == 5) { Fasets5Count = Fasets5Count - 1; };

        //                            result = 12 * aimFasetsCount - (wellConnectedVertexCount - aimVertexCount) + 0.0 * Fasets5Count + 2.0 * Math.Min(12.0, Fasets4Count) + 1 * Math.Min(12.0, Fasets3Count);
        //                            #endregion

        //                            #region  Quadric
        //                            // Quadric

        //                            //result = (4 * aimFasetsCount + aimVertexCount - wellConnectedVertexCount);
        //                            #endregion
        //                            // Triangle

        //                            #region Triangle

        //                            //result = 2 * aimFasetsCount + aimVertexCount - wellConnectedVertexCount;
        //                            #endregion

        //                        }
        //                    }

        //                }

        //            }
        //        }
        //    }
        //}



        //#region окружность
        ////double result;



        ////if (graph.VertexCount == 1)
        ////{
        ////    result = -100;
        ////}
        ////else
        ////{

        ////    if ((graph.VertexCount >= 20))
        ////    {
        ////        result = -80.0;
        ////    }
        ////    else
        ////    {
        ////        if (stepsPassed >= UnfoldingMaxStepsCount - 2)
        ////        {
        ////            result = -60.0;
        ////        }
        ////        else
        ////        {

        ////            bool isPlanar;
        ////            List<Cycle<Physical2DGraphVertex>> fasets = graph.Planarize(out isPlanar);

        ////            if (fasets.Count <= 1)
        ////            {
        ////                result = -50.0;
        ////            }
        ////            else
        ////            {
        ////                var minFasetLength = (from f in fasets
        ////                                      orderby f.MinCycleLength
        ////                                      select f).First().MinCycleLength;


        ////                if (minFasetLength < 6)
        ////                {
        ////                    // от -33 до -16.666 увеличиваем минимальный цикл
        ////                    result = -100.0 / minFasetLength;

        ////                }
        ////                else
        ////                {
        ////                    if (fasets.Count > 2)
        ////                    {
        ////                        // от -10 до -1 - доводим количество циклов до 2-х
        ////                        result = Math.Min(9, fasets.Count - 2) * -1.0 - 1.0;
        ////                    }
        ////                    else
        ////                    {
        ////                        // удаляем одинокие узлы
        ////                        //result = curVerticesDistributionByDegree.
        ////                        int oneDegreesCount = graph.Vertices.Where(x => graph.AdjacentDegree(x) == 1).Count();

        ////                        // от -1 до 0 - доводим количество деревьев до 0
        ////                        result = Math.Exp(-1 * oneDegreesCount) - 1;
        ////                    }
        ////                }

        ////            }
        ////        }
        ////    }
        ////}
        //#endregion

        //return result;

        //#endregion

        #endregion

        object IFitnessFunction.Translate(IChromosome chromosome)
        {
            return TranslateNative(chromosome);

        }

        public ChangeTable TranslateNative(IChromosome chromosome)
        {
            if (chromosome == null)
            {
                return new ChangeTable();
            }
            else
            {
                return ((GUMChromosome)chromosome).GetChangeTable();
            }


        }


    }

    public class BySamplePlanarGraphFitnessFunction : PlanarGraphFitnessFunction
    {

        Dictionary<int, int> fasetsDistributionByLength;
        Dictionary<int, int> verticesDistributionByDegree;
        /// <summary>
        /// Фитнес-функция планарного графа. Чем ближе статистика графа к статистике, переданной
        /// </summary>
        /// <param name="fasetsDistributionByLength">целевое распределение граней по их длине, в виде массива пар "Key, Value". 
        /// Key - длина грани, Value - количество граней с такой длиной</param>
        /// <param name="verticesDistributionByDegree">целевое распределение узлов графа по их степени в виде пар "Key, Value".
        ///  Key - степень узла, Value - количество узлов в графе с такой степенью-</param>
        public BySamplePlanarGraphFitnessFunction(Dictionary<int, int> fasetsDistributionByLength,
                                            Dictionary<int, int> verticesDistributionByDegree,
                                            int maxGUCAIterationCount,
                                            int maxVertexCount,
                                            bool isGenomeLengthPenalty,
                                            bool isNotPlannedPenalty,
                                            NumericalMethodParametres unfoldingParametres,
                                            TranscriptionWay transcriptionWay)
            : base(maxGUCAIterationCount, maxVertexCount, isGenomeLengthPenalty, isNotPlannedPenalty, unfoldingParametres, transcriptionWay)
        {

            this.fasetsDistributionByLength = fasetsDistributionByLength;
            this.verticesDistributionByDegree = verticesDistributionByDegree;


        }

        /// <summary>
        /// Возвращает распределение узлов по их степени
        /// </summary>
        /// <param name="graph"></param>
        /// <returns></returns>
        private Dictionary<int, int> GetVerticiesDistributionByDegree(Physical2DGraph.Physical2DGraph graph)
        {

            var vertParts = from x in graph.Vertices
                            group x by graph.AdjacentEdges(x).Count() into part
                            orderby part.Key
                            select new
                            {
                                Key = part.Key,
                                Count = part.Count()
                            };
            Dictionary<int, int> result = new Dictionary<int, int>();
            foreach (var part in vertParts)
            {
                result.Add(part.Key, part.Count);
            }

            return result;
        }

        /// <summary>
        /// возвращает распределение граней по их степени
        /// </summary>
        /// <param name="graph"></param>
        /// <returns></returns>
        private Dictionary<int, int> GetFasetsDistributionByLength(List<Cycle<Physical2DGraphVertex>> fasets)
        {

            var fasetParts = from x in fasets
                             group x by x.Count
                                 //group x by x.MinCycleLength
                                 into part
                                 orderby part.Key
                                 select new
                                 {
                                     Key = part.Key,
                                     Count = part.Count()
                                 };


            Dictionary<int, int> result = new Dictionary<int, int>();
            foreach (var part in fasetParts)
            {
                result.Add(part.Key, part.Count);
            }


            return result;
        }

        public override double Evaluate(Physical2DGraph.Physical2DGraph graph)
        {

            if (isNotPlannedPenalty)
            {
                // TODO: использовать для ускорения развёртывания знание о топологии
                graph.ProcessUnfoldingModel(this.unfoldingParametres, new Point(0, 0)); // затратная операция!
                if (!graph.IsPlanned()) { return 1.2; }
            }


            if (!graph.IsPlanarized)
            {
                graph.Planarize();
            }

            // 1. Находим распределение узлов по степеням и граней по длине  получившегося графа
            //bool isPlanar;


            Dictionary<int, int> curFasetsDistributionByLength = graph.GetFasetsDistributionByLength();
            Dictionary<int, int> curVerticesDistributionByDegree = graph.GetVerticiesDistributionByDegree();

            // 2.Расчитываем дистанцию между целевым распределением узлов по степеням и распределением получившегося графа
            var vertUnion = (from x in curVerticesDistributionByDegree
                             select new
                             {
                                 Key = x.Key,
                                 Value = -x.Value
                             }).Union
                                (from y in this.verticesDistributionByDegree
                                 select new
                                 {
                                     Key = y.Key,
                                     Value = y.Value
                                 }
                                );


            var vertGroupedSum =
                    from x in vertUnion
                    group x by x.Key into g
                    select new { g.Key, KeySum = g.Sum(x => x.Value) };

            int vertDistance = vertGroupedSum.Sum(x => Math.Abs(x.KeySum));

            // 3.Расчитываем дистанцию между целевым распределением граней по длине и распределением получившегося графа
            var fasetsUnion = (from x in curFasetsDistributionByLength
                               select new
                               {
                                   Key = x.Key,
                                   Value = -x.Value
                               }).Union
                               (from y in fasetsDistributionByLength
                                select new
                                {
                                    Key = y.Key,
                                    Value = y.Value
                                }
                               );

            int fasetDistance =
                    (from x in fasetsUnion
                     group x by x.Key into g
                     select new { g.Key, KeySum = g.Sum(x => x.Value) })
                    .Sum(x => Math.Abs(x.KeySum));


            // 4. чем больше дистанция, тем менее пригоден к жизни получившийся граф:
            // 1-ый приоритет: количество граней.
            double result = Math.Abs(fasetsDistributionByLength.Sum(x => x.Value) - curFasetsDistributionByLength.Sum(x => x.Value));
            //result =  - result*100 - 10*fasetDistance - vertDistance;

            return result;


            //double result = -101;


            #region Old

            //    {
            //        //!!! Для "производства" сетки:
            //        //Минимальная длина цикла должна быть больше 
            //        int MinCycleLength = fasets.Min(x => x.MinCycleLength);

            //        // целевой размер ячейки сетки: 
            //        int AimMeshCycleLength = 6;
            //        // целевая связность узла сетки:
            //        int AimVertexDegree = (AimMeshCycleLength == 4) ? 4 : (AimMeshCycleLength == 3) ? 6 : 3;


            //        //if ((MinCycleLength < AimMeshCycleLength) && (graph.VertexCount <= 10))
            //        //{
            //        //    if (MinCycleLength < 4)
            //        //    {
            //        //        result = -96.0;
            //        //    }
            //        //    else if (MinCycleLength < 5)
            //        //    {
            //        //        result = -95;
            //        //    }
            //        //    else if (MinCycleLength < 6)
            //        //    {
            //        //        result = -94;
            //        //    }

            //        //}
            //        //else
            //        {
            //            // дополнительные ограничения
            //            bool isTopologyFilter = true;


            //            if (isTopologyFilter)
            //            {
            //                isTopologyFilter = graph.IsBeconnected();
            //            }

            //            // проверка на уложенность графа на плоскости:
            //            if (isTopologyFilter && checkIsPlanned)
            //            {
            //                graph.Unfold(new Point(0, 0));
            //                isTopologyFilter = graph.IsPlanned();
            //            };


            //            if (!isTopologyFilter)
            //            {
            //                result = -90.0;
            //                return result;
            //            }
            //            else
            //            {




            //                // максимальное колво связей у вершины не должно превышать 5-ти
            //                int MaxVertexDegree = graph.Vertices.Max(x => graph.AdjacentDegree(x));
            //                //int MinVertexDegree = graph.Vertices.Min(x => graph.AdjacentDegree(x));
            //                //int MaxVertexDegreeInMaxCyle = (from f in fasets orderby f.MinCycleLength() descending select f).First().Vertices.Max(x => graph.AdjacentDegree(x));

            //                if (MaxVertexDegree > 4) // для Hex + 3 /*|| MaxVertexDegreeInMaxCyle > 3 /*|| MinVertexDegree < 2*/)
            //                {
            //                    result = -89.0;
            //                }
            //                else
            //                {

            //                    //Dictionary<int, int> curFasetsDistributionByLength = this.GetFasetsDistributionByLength(fasets);
            //                    //Dictionary<int, int> curVerticesDistributionByDegree = this.GetVerticiesDistributionByDegree(graph);
            //                    //curFasetsLength = new List<int>();

            //                    // Найдём "топологическое" расстояние между графами, используя меры "степень вершин", "длина граней"
            //                    // сумируя разницу между попарно наиболее близкими гранями или вершинами.

            //                    // для каждой грани из текущего графа ищем грань из целевого графа ближайшую по длине. Разницу между длинами суммируем.
            //                    // если в текущем графе остаются грани, а в целевом графе уже закончились

            //                    #region Обобщённый алгоритм сравнения топологий:
            //                    /*
            //                #region Вычисляем дистанцию по фасеткам

            //                // заполняем список длин фасеток целевого графа
            //                List<int> aimFasetsLength = new List<int>();
            //                foreach (KeyValuePair<int, int> pair in fasetsDistributionByLength)
            //                {
            //                    for (int i = 0; i < pair.Value; i++)
            //                    {
            //                        aimFasetsLength.Add(pair.Key);
            //                    }
            //                };
            //                aimFasetsLength.Sort();

            //                // -- заполняем список длин фасеток текущего графа
            //                List<int> curFasetsLength = (from f in fasets select f.MinCycleLength).ToList<int>();
            //                int aimLength = (from x in fasetsDistributionByLength select x).Sum(x => x.Value);

            //                // Если в текущем графе меньше фасеток чем в целевом, то добавлем
            //                if (aimLength > curFasetsLength.Count)
            //                {
            //                    for (int i = curFasetsLength.Count; i < aimLength; i++)
            //                    {
            //                        curFasetsLength.Add(0);
            //                    }
            //                }




            //                // Рассчитываем сумму
            //                double fasetDistance = 0;

            //                #region удаляем полные совпадения

            //                List<int> toDelete = new List<int>();
            //                toDelete.Clear();

            //                foreach (int fl in curFasetsLength)
            //                {
            //                    // удаляем полные совпадения
            //                    if (aimFasetsLength.Contains(fl))
            //                    {
            //                        toDelete.Add(fl);
            //                        aimFasetsLength.Remove(fl);
            //                    }
            //                }

            //                foreach (int i in toDelete)
            //                {
            //                    curFasetsLength.Remove(i);
            //                }

            //                #endregion

            //                foreach (int fl in curFasetsLength.OrderBy(x => x))
            //                {
            //                    // находим ближайшую по длине целевую фасетку
            //                    int aimFL = (from x in aimFasetsLength
            //                                 orderby Math.Abs(x - fl)
            //                                 select x).FirstOrDefault();

            //                    fasetDistance = fasetDistance + Math.Abs(aimFL - fl);
            //                    // удаляем фасетку как рассмотренную 
            //                    aimFasetsLength.Remove(aimFL);
            //                }

            //                #endregion

            //                #region вычисляем дистанцию по вершинам

            //                // заполняем список степеней вершин целевого графа
            //                List<int> aimVertexDegree = new List<int>();
            //                foreach (KeyValuePair<int, int> pair in verticesDistributionByDegree)
            //                {
            //                    for (int i = 0; i < pair.Value; i++)
            //                    {
            //                        aimVertexDegree.Add(pair.Key);
            //                    }
            //                };
            //                aimVertexDegree.Sort();

            //                // -- заполняем список степеней вершин текущего графа
            //                List<int> curVertexLength = (from v in graph.Vertices select graph.AdjacentDegree(v)).ToList<int>();

            //                int vertAimLengthSum = (from x in verticesDistributionByDegree select x).Sum(x => x.Value);

            //                // Если в текущем графе меньше вершин чем в целевом, то добавлем
            //                if (vertAimLengthSum > curVertexLength.Count)
            //                {
            //                    for (int i = curVertexLength.Count; i < vertAimLengthSum; i++)
            //                    {
            //                        curVertexLength.Add(0);
            //                    }
            //                }


            //                //List<int> toDelete = new List<int>();
            //                toDelete.Clear();

            //                foreach (int fl in curVertexLength)
            //                {
            //                    // удаляем полные совпадения
            //                    if (aimVertexDegree.Contains(fl))
            //                    {
            //                        toDelete.Add(fl);
            //                        aimVertexDegree.Remove(fl);
            //                    }
            //                }

            //                foreach (int i in toDelete)
            //                {
            //                    curVertexLength.Remove(i);
            //                }



            //                // Рассчитываем сумму
            //                double vertivesDistance = 0;

            //                foreach (int fl in curVertexLength.OrderByDescending(x => x))
            //                {
            //                    // находим ближайшую по длине целевую фасетку
            //                    int aimFL = (from x in aimVertexDegree
            //                                 orderby Math.Abs(x - fl)
            //                                 select x).FirstOrDefault();

            //                    vertivesDistance = vertivesDistance + Math.Abs(aimFL - fl);
            //                    // удаляем фасетку как рассмотренную 
            //                    aimVertexDegree.Remove(aimFL);
            //                }

            //                #endregion
            //                */
            //                    #endregion


            //                    //  сетка
            //                    double aimFasetsCount = (from f in fasets where f.MinCycleLength == AimMeshCycleLength select f).Count();

            //                    //double wellConnectedVertexCount = (double)(from x in graph.Vertices w).Count();
            //                    double wellConnectedVertexCount = graph.VertexCount;// (double)graph.Vertices.Where(x => x.ConnectionsCount > 1).Count();
            //                    double aimVertexCount = (double)graph.Vertices.Where(x => x.ConnectionsCount == AimVertexDegree).Count();

            //                    int MaxCycleLength = fasets.Max(x => x.MinCycleLength);
            //                    // для кольца - исключаем внешний цикл
            //                    if (MaxCycleLength == AimMeshCycleLength) { aimFasetsCount = aimFasetsCount - 1; };

            //                    // доля фасеток к количеству фасеток и узлов - макс и количество фасеток - побольше.

            //                    #region Hex
            //                    // Hex
            //                    //result = -10.0 * (0.5 - ((double)aimFasetsCount + 0.5 * Fasets5Count + 0.3 * Fasets4Count + 0.2*Fasets3Count) / (double)graph.Vertices.Count()

            //                    //) 
            //                    //        - 8.0 + 0.5*(double)aimFasetsCount; // -0.33 * vertivesDistance - fasetDistance - (fasets4Count
            //                    double Fasets3Count = (from f in fasets where f.MinCycleLength == 3 select f).Count();

            //                    double Fasets4Count = (from f in fasets where f.MinCycleLength == 4 select f).Count();
            //                    if (MaxCycleLength == 4) { Fasets4Count = Fasets4Count - 1; };

            //                    double Fasets5Count = (from f in fasets where f.MinCycleLength == 5 select f).Count();
            //                    if (MaxCycleLength == 5) { Fasets5Count = Fasets5Count - 1; };

            //                    result = 12 * aimFasetsCount - (wellConnectedVertexCount - aimVertexCount) + 0.0 * Fasets5Count + 2.0 * Math.Min(12.0, Fasets4Count) + 1 * Math.Min(12.0, Fasets3Count);
            //                    #endregion

            //                    #region  Quadric
            //                    // Quadric

            //                    //result = (4 * aimFasetsCount + aimVertexCount - wellConnectedVertexCount);
            //                    #endregion
            //                    // Triangle

            //                    #region Triangle

            //                    //result = 2 * aimFasetsCount + aimVertexCount - wellConnectedVertexCount;
            //                    #endregion

            //                }
            //            }

            //        }

            //    }
            //} }
            #endregion



        }

    }

    public class TriangleMeshPlanarGraphFitnessFunction : PlanarGraphFitnessFunction
    {

        double shellVertexWeight;

        public TriangleMeshPlanarGraphFitnessFunction(
            int maxGUCAIterationCount,
            int maxVertexCount,
            bool isGenomeLengthPenalty,
            bool isNotPlannedPenalty,
            NumericalMethodParametres unfoldingParametres,
            TranscriptionWay transcriptionWay,
            double shellVertexWeight)
            : base(maxGUCAIterationCount, maxVertexCount, isGenomeLengthPenalty, isNotPlannedPenalty, unfoldingParametres, transcriptionWay)
        {
            this.shellVertexWeight = shellVertexWeight;
        }

        public override double Evaluate(Physical2DGraph.Physical2DGraph graph)
        {

            double result;

            if (!graph.IsPlanarized)
            {
                graph.Planarize();
            }

            List<Cycle<Physical2DGraphVertex>> fasets = graph.Fasets;


            //int MinCycleLength = fasets.Min(x => x.MinCycleLength);

            // целевой размер ячейки сетки: 
            int AimMeshCycleLength = 3;
            // целевая связность узла сетки:
            int AimVertexDegree = 6;



            if (graph.VertexCount <= 2) { return 1.0; }

            // для фильтрации затратных вычислений - проверяем на минимальную пригодность топологию графа до того 
            // как будем вычислять размещение на плоскости и статистику вершин)
            // дополнительные ограничения: граф должен иметь хотя бы одну грань
            if (fasets.Count == 1) { return 1.01; }
            // дополнительные ограничения: граф должен двусвязным                                            
            if (!graph.IsBeconnected()) { return 1.02; }
            // дополнительные ограничения: граф должен быть уложен на плоскости в результате 2D развёртывания


            // максимальное колво связей у вершины не должно превышать 5-ти
            int MaxVertexDegree = graph.Vertices.Max(x => graph.AdjacentDegree(x));
            if (MaxVertexDegree > 6) { return 1.03; }



            if (isNotPlannedPenalty)
            {
                // TODO: использовать для ускорения развёртывания знание о топологии
                graph.ProcessUnfoldingModel(this.unfoldingParametres, new Point(0, 0)); // затратная операция!
                if (!graph.IsPlanned()) { return 1.06; }
            }




            double wellConnectedVertexCount = graph.VertexCount;// (double)graph.Vertices.Where(x => x.ConnectionsCount > 1).Count();


            Cycle<Physical2DGraphVertex> shellFaset = (from f in fasets orderby f.MinCycleLength descending select f).First();

            int MaxCycleLength = shellFaset.MinCycleLength; // fasets.Max(x => x.MinCycleLength);

            int perimetr = shellFaset.Count;
            double innerVertexCount = graph.VertexCount - perimetr;
            result = 1.01 * (double)fasets.Count + 1.1 * innerVertexCount - perimetr + 20;

            // begin
             // подсчитываем количество вершин c целевым количеством соседей, иключая те их них, которые принандлежат периметру 
            double outerAimVertexCount = (double)shellFaset.Vertices.Take(shellFaset.Count).Where(x => x.ConnectionsCount == AimVertexDegree).Count();
            double innerAimVertexCount = (double)graph.Vertices.Where(x => x.ConnectionsCount == AimVertexDegree).Count() - outerAimVertexCount;

            double Fasets3Count = (from f in fasets where f.MinCycleLength == 3 select f).Count();
            // для кольца - исключаем внешний цикл
            if (MaxCycleLength == AimMeshCycleLength) { Fasets3Count = Fasets3Count - 1; };

            double Fasets4Count = (from f in fasets where f.MinCycleLength == 4 select f).Count();
            // для кольца - исключаем внешний цикл
            if (MaxCycleLength == AimMeshCycleLength) { Fasets4Count = Fasets4Count - 1; };


            //result = 2 * Fasets3Count + innerAimVertexCount + shellVertexWeight*outerAimVertexCount - graph.VertexCount;
            result = 2 * Fasets3Count + innerAimVertexCount - shellVertexWeight * shellFaset.Count - graph.VertexCount + 20;
            
            //result = 2 * Fasets3Count + innerAimVertexCount + shellVertexWeight * outerAimVertexCount - MaxCycleLength - Fasets4Count;
             
            // end
            return result;
        }

    }

    public class QuadricMeshPlanarGraphFitnessFunction : PlanarGraphFitnessFunction
    {
        double shellVertexWeight;
        private double faset3penaltyProbability;

        public QuadricMeshPlanarGraphFitnessFunction(
                                            int maxGUCAIterationCount,
                                            int maxVertexCount,
                                            bool isGenomeLengthPenalty,
                                            bool isNotPlannedPenalty,
                                            NumericalMethodParametres unfoldingParametres,
                                            TranscriptionWay transcriptionWay,
                                            double shellVertexWeight,
                                            double faset3penaltyProbability)
            : base(maxGUCAIterationCount, maxVertexCount, isGenomeLengthPenalty, isNotPlannedPenalty, unfoldingParametres, transcriptionWay)
        {
            this.shellVertexWeight = shellVertexWeight;
            this.faset3penaltyProbability = faset3penaltyProbability;
        }


        public override double Evaluate(Physical2DGraph.Physical2DGraph graph)
        {

            double result;

            if (!graph.IsPlanarized)
            {
                graph.Planarize();
            }

            List<Cycle<Physical2DGraphVertex>> fasets = graph.Fasets;

            double penalty = 0;



            // целевой размер ячейки сетки: 
            //int AimMeshCycleLength = 4;
            // целевая связность узла сетки:
            int AimVertexDegree = 4;



            if (graph.VertexCount <= 2) { return 1.0; }

            // для фильтрации затратных вычислений - проверяем на минимальную пригодность топологию графа до того 
            // как будем вычислять размещение на плоскости и статистику вершин)
            // дополнительные ограничения: граф должен иметь хотя бы одну грань
            if (fasets.Count == 1) { return 1.01; }
            // дополнительные ограничения: граф должен двусвязным                                            
            if (!graph.IsBeconnected()) { return 1.02; }
            // дополнительные ограничения: граф должен быть уложен на плоскости в результате 2D развёртывания


            // максимальное колво связей у вершины не должно превышать 4-ти
            int MaxVertexDegree = graph.Vertices.Max(x => graph.AdjacentDegree(x));
            if (MaxVertexDegree > 6) { return 1.03; }
            if (MaxVertexDegree > 5) { return 1.04; }
            if (MaxVertexDegree > 4) { return 1.06; }


            int MinCycleLength = fasets.Min(x => x.MinCycleLength);

            //if ((MinCycleLength < 4) && (fasets.Count == 2)) { return 1.07; }
            //if (MinCycleLength < 4)  { return 1.08; }

            if (faset3penaltyProbability > 0)
            {
                int Fasets3Count = (from f in fasets where f.MinCycleLength == 3 select f).Count();


                if ((Fasets3Count > 0) && (RandomGen3.NextDouble() < faset3penaltyProbability)) { return 1.08; };
            }

            // "Оболочка сети"
            Cycle<Physical2DGraphVertex> shellFaset = (from f in fasets orderby f.MinCycleLength descending select f).First();






            if (isNotPlannedPenalty)
            {
                // TODO: использовать для ускорения развёртывания знание о топологии
                graph.ProcessUnfoldingModel(this.unfoldingParametres, new Point(0, 0)); // затратная операция!
                if (!graph.IsPlanned()) { return 1.1; }
            }




            double wellConnectedVertexCount = graph.VertexCount;// (double)graph.Vertices.Where(x => x.ConnectionsCount > 1).Count();



            int MaxCycleLength = shellFaset.MinCycleLength; // fasets.Max(x => x.MinCycleLength);

            // подсчитываем количество вершин c целевым количеством соседей, иключая те их них, которые принандлежат периметру 
            double outerAimVertexCount = (double)shellFaset.Vertices.Take(shellFaset.Count).Where(x => x.ConnectionsCount == AimVertexDegree).Count();
            double innerAimVertexCount = (double)graph.Vertices.Where(x => x.ConnectionsCount == AimVertexDegree).Count() - outerAimVertexCount;


            if (fasets.Count > 2)
            {
                // Узлы с количеством связей меньше должны быть только внешние. Если есть внутренние узлы с количеством связей < 4, то штраф
                int innerNotAimVertexCount = graph.Vertices.Where(x => (x.ConnectionsCount != AimVertexDegree && !shellFaset.Vertices.Contains(x))).Count();


                //penalty = penalty + innerNotAimVertexCount * 10.0;
                //return 1.08;
                if (innerNotAimVertexCount > 0) return 1.11;
            }



            // для кольца - исключаем внешний цикл            
            double Fasets4Count = (from f in fasets where f.MinCycleLength == 4 select f).Count();
            if (MaxCycleLength == 4) { Fasets4Count = Fasets4Count - 1; };

            //double Fasets3Count = (from f in fasets where f.MinCycleLength == 3 select f).Count();
            //if (MaxCycleLength == 3) { Fasets4Count = Fasets3Count - 1; };

            //result = Math.Max(3.99, 2 * Fasets4Count + 2*innerAimVertexCount + shellVertexWeight * outerAimVertexCount - wellConnectedVertexCount + 4.0 - penalty);
            double koef = Fasets4Count <= 4 ? 2.1 : 2;
            result = Math.Max(3.98, 2.1 * Fasets4Count + 2 * innerAimVertexCount - wellConnectedVertexCount + 10.0);

            return result;
        }


    }

    public class HexMeshPlanarGraphFitnessFunction : PlanarGraphFitnessFunction
    {

        double shellVertexWeight;

        public HexMeshPlanarGraphFitnessFunction(
                                            int maxGUCAIterationCount,
                                            int maxVertexCount,
                                            bool isGenomeLengthPenalty,
                                            bool isNotPlannedPenalty,
                                            NumericalMethodParametres unfoldingParametres,
                                            TranscriptionWay transcriptionWay,
                                            double shellVertexWeight)
            : base(maxGUCAIterationCount, maxVertexCount, isGenomeLengthPenalty, isNotPlannedPenalty, unfoldingParametres, transcriptionWay)
        {
            this.shellVertexWeight = shellVertexWeight;
        }

        public override double Evaluate(Physical2DGraph.Physical2DGraph graph)
        {

            double result;

            if (!graph.IsPlanarized)
            {
                graph.Planarize();
            }

            List<Cycle<Physical2DGraphVertex>> fasets = graph.Fasets;


            //int MinCycleLength = fasets.Min(x => x.MinCycleLength);

            // целевой размер ячейки сетки: 
            int AimMeshCycleLength = 6;
            // целевая связность узла сетки:
            int AimVertexDegree = 3;

            if (graph.VertexCount <= 2) { return 1.0; }

            // для фильтрации затратных вычислений - проверяем на минимальную пригодность топологию графа до того 
            // как будем вычислять размещение на плоскости и статистику вершин)
            // дополнительные ограничения: граф должен иметь хотя бы одну грань
            if (fasets.Count == 1) { return 1.01; }
            // дополнительные ограничения: граф должен двусвязным                                            
            if (!graph.IsBeconnected())
            {
                if (RandomGen3.NextDouble() < shellVertexWeight)
                {
                    return 1.02;
                }
            }
            // дополнительные ограничения: граф должен быть уложен на плоскости в результате 2D развёртывания


            // максимальное колво связей у вершины не должно превышать 6-ти (
            // но только если не шестиугольник
            int MaxVertexDegree = graph.Vertices.Max(x => graph.AdjacentDegree(x));
            if (MaxVertexDegree > 6) { return 1.03; }
            if ((MaxVertexDegree > 5) && (graph.VertexCount > 7)) { return 1.04; }
            if ((MaxVertexDegree > 4) && (graph.VertexCount > 7)) { return 1.05; }
            //if ((MaxVertexDegree > 3) && (graph.VertexCount > 7)) 
            //{
            //    if (RandomGen3.NextDouble() < shellVertexWeight)
            //    {
            //        return 1.05;
            //    }
            //}




            double V = graph.VertexCount;// (double)graph.Vertices.Where(x => x.ConnectionsCount > 1).Count();

            // оболочка - самая большая грань:
            Cycle<Physical2DGraphVertex> shell = (from f in fasets orderby f.MinCycleLength descending select f).First();

            int MaxCycleLength = shell.MinCycleLength; // fasets.Max(x => x.MinCycleLength);

            // подсчитываем количество вершин c целевым количеством соседей, иключая те их них, которые принандлежат периметру 
            //double outerAimVertexCount = (double)shellFaset.Vertices.Take(shellFaset.Count).Where(x => x.ConnectionsCount == AimVertexDegree).Count();
            //double innerAimVertexCount = (double)graph.Vertices.Where(x => x.ConnectionsCount == AimVertexDegree).Count() - outerAimVertexCount;


            // подсчитываем количество внутренних вершин, степень которых не равна три
            int VinnerNot3 = graph.Vertices.Where(x => (x.ConnectionsCount != 3) && !shell.Vertices.Contains(x)).Count();
            if (VinnerNot3 > 0)
            { // есть внутренние вершины степень которых <> 3
                List<Physical2DGraphVertex> Vinnrt4List = graph.Vertices.Where(x => (x.ConnectionsCount == 4) && !shell.Vertices.Contains(x)).ToList();
                //int Vinner4 = graph.Vertices.Where(x => (x.ConnectionsCount == 4) && !shell.Vertices.Contains(x)).Count();
                // тем не менее разрешаем двум вершинам быть четырёх угольными
                if (!(VinnerNot3 == Vinnrt4List.Count))
                {
                    // есть не четытрехсвязные вершины: (2,5,6...)
                    return 1.08;
                }
                else
                {
                    // разрешаем 4х связные вершины, но только если 
                    // они принадлежат не более чем 2-м шестиугольным граням
                    if (!((Vinnrt4List.Count < 4) && (!Vinnrt4List.Exists(x => x.Fasets.Where(f => f.MinCycleLength == 6).Count() > 2))))
                    {
                        return 1.09;
                    }


                }
            };

            // внешних вершин степени 4 которые принадлежат более чем 2 шестиугольникам - тоже не должно быть:
            var VOuter4List = graph.Vertices.Where(x => (x.ConnectionsCount == 4) && shell.Vertices.Contains(x));

            if (VOuter4List.Any(x => x.Fasets.Where(f => f.MinCycleLength == 6).Count() > 2))
            {
                return 1.1;
            }


            if (isNotPlannedPenalty)
            {
                // TODO: использовать для ускорения развёртывания знание о топологии
                if (RandomGen3.NextDouble() < shellVertexWeight)
                {
                    graph.ProcessUnfoldingModel(this.unfoldingParametres, new Point(0, 0)); // затратная операция!
                    if (!graph.IsPlanned())
                    {
                        return 1.06;
                    }
                }
            }

            // подсчитываем количество внутренних вершин, степени три и которые связаны только с гранями-шестиугольниками
            // (Т.е. длина оболочки <> 6, то на "внутренность" можно не проверяить.)
            double V3inner = graph.Vertices.Where(x => x.ConnectionsCount == 3 && x.Fasets.Where(f => f.MinCycleLength == 6).Count() == 3).Count();

            double F6 = (from f in fasets where f.MinCycleLength == 6 select f).Count();
            if (MaxCycleLength == 6) { F6 = F6 - 1; };



            double F3 = (from f in fasets where f.MinCycleLength == 3 select f).Count();
            if (MaxCycleLength == 3) { F3 = F3 - 1; }

            if (F3 > 0)
            {
                if (RandomGen3.NextDouble() < shellVertexWeight)
                {
                    return 1.05;
                }
            }

            double F4 = (from f in fasets where f.MinCycleLength == 4 select f).Count();
            if (MaxCycleLength == 4) { F4 = F4 - 1; };
            //double Fasets5Count = (from f in fasets where f.MinCycleLength == 5 select f).Count();
            //if (MaxCycleLength == 5) { Fasets5Count = Fasets5Count - 1; };

          

            result = 0;

            if (F4 > 10)
                if (RandomGen3.NextDouble() < shellVertexWeight)
                {
                    result = result - 10;
                }

            //result = 12 * aimFasetsCount + innerAimVertexCount + shellVertexWeight * outerAimVertexCount - wellConnectedVertexCount + 0.0 * Fasets5Count + 4.0 * Math.Min(32.0, Fasets4Count) + 1 * Math.Min(32.0, Fasets3Count) + 4.0;
            result = result + 5.1 * F6 + 2.01 * F4 + 4.0 * V3inner - V + 10.0;

            return Math.Max(result, 1.1);
        }

    }

    public class GumGen
    {

        public bool WasActive = false;
        public byte Status;
        public byte PriorStatus;
        public byte Connections_GE;
        public byte Connections_LE;
        public byte Parents_GE;
        public byte Parents_LE;
        public byte OperationType;
        public byte OperandStatus;

        public GumGen()
        {
            SetValue(0);
        }

        public GumGen(ulong value)
        {
            SetValue(value);
        }

        public ulong GetValue()
        {
            ulong result = 0;

            result = result | this.Status;
            result = result << 8;
            result = result | this.PriorStatus;
            result = result << 8;
            result = result | this.Connections_GE;
            result = result << 8;
            result = result | this.Connections_LE;
            result = result << 8;
            result = result | this.Parents_GE;
            result = result << 8;
            result = result | this.Parents_LE;
            result = result << 8;
            result = result | this.OperationType;
            result = result << 8;
            result = result | this.OperandStatus;



            return result;
        }

        public void SetValue(ulong value)
        {

            this.OperandStatus = Math.Max((byte)1, (byte)(value & 0x1F));
            value = value >> 8;

            this.OperationType = (byte)(value & 0x0F);
            value = value >> 8;

            this.Parents_LE = (byte)(value);
            value = value >> 8;

            this.Parents_GE = (byte)(value);
            value = value >> 8;

            this.Connections_LE = (byte)(value & 0x0F);
            value = value >> 8;

            this.Connections_GE = (byte)(value & 0x0F);
            value = value >> 8;

            this.PriorStatus = (byte)(value & 0x1F);
            value = value >> 8;

            this.Status = Math.Max((byte)1, (byte)(value & 0x1F));
        }

        public ChangeTableItem ToChangeTableItem()
        {
            OperationCondition condition = new OperationCondition();
            Operation operation = new Operation();

            condition.CurrentState = (NodeState)Status;
            //condition.PriorState = (NodeState)Status;
            condition.PriorState = (NodeState)PriorStatus;
            //condition.PriorState = NodeState.Ignored;

            condition.AllConnectionsCount_GE = Connections_GE > 8 ? -1 : Connections_GE;
            condition.AllConnectionsCount_LE = Connections_LE > 8 ? -1 : Connections_LE;
            //condition.AllConnectionsCount_GE = Connections_GE % 8;
            //condition.AllConnectionsCount_LE = Connections_LE % 8;

            //condition.AllConnectionsCount_LE = condition.AllConnectionsCount_GE;

            condition.ParentsCount_GE = Parents_GE > 64 ? -1 : Parents_GE;
            condition.ParentsCount_LE = Parents_LE > 64 ? -1 : Parents_LE;

            //condition.ParentsCount_LE = condition.ParentsCount_GE;



            /* Разрешённые операции:
                TurnToState  - 0x0,
                TryToConnectWithNearest 0x1,
                GiveBirthConnected 0x2,
                DisconectFrom 0x3
                Die 0x4,
                
            */
            operation.Kind = (OperationKindEnum)(OperationType % 4);
            operation.OperandNodeState = (NodeState)OperandStatus;


            return new ChangeTableItem(condition, operation);
        }


    }

}