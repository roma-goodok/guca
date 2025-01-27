/* (c) Roman Gudchenko 2010
This code provided as reference of Graph Unfolding Cellular Automata (GUCA) to reimplement it on TypeScript
*/
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using QuickGraph;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;
using Physical2DGraph; // (!) wrapper over QuickGraph library

/// <summary>
/// Implementation of the evolution (unfolding) of a neural network based on the principles of finite automata evolution
/// First, for simplicity, we will implement an undirected unweighted network
/// </summary>
namespace GraphUnfoldingMachine
{
    /// <summary>
    /// TODO: describe principles and design decisions
    /// </summary>

    /// <summary>
    /// Node state.
    /// 1,2,3, ... - node states
    /// -1 - unknown state (for previous means the object has just been born);
    /// 0 - ignored (any)
    /// </summary>
    public enum NodeState : byte
    {
        Max = 255, Min = 0, Ignored = 0, Unknown = 254,
        A = 1, B = 2, C = 3, D = 4, E = 5, F = 6, G = 7, H = 8, I = 9,
        J = 10, K = 11, L = 12, M = 13, N = 14, O = 15, P = 16, Q = 17, R = 18, S = 19,
        T = 20, U = 21, V = 22, W = 23, X = 24, Y = 25, Z = 26, s27 = 27, s28 = 28, s29 = 29,
        s30 = 30, s31 = 31, s32 = 32, s33 = 33, s34 = 34, s35 = 35, s36 = 36, s37 = 37, s38 = 38, s39 = 39,
        s40 = 40, s41 = 41, s42 = 42, s43 = 43, s44 = 44, s45 = 45, s46 = 46, s47 = 47, s48 = 48, s49 = 49,
        s50 = 50, s51 = 51, s52 = 52, s53 = 53, s54 = 54, s55 = 55, s56 = 56, s57 = 57, s58 = 58, s59 = 59,
        s60 = 60, s61 = 61, s62 = 62, s63 = 63, s64 = 64, s65 = 65, s66 = 66, s67 = 67, s68 = 68, s69 = 69,
        s70 = 70, s71 = 71, s72 = 72, s73 = 73, s74 = 74, s75 = 75, s76 = 76, s77 = 77, s78 = 78, s79 = 79,
        s80 = 80, s81 = 81, s82 = 82, s83 = 83, s84 = 84, s85 = 85, s86 = 86, s87 = 87, s88 = 88, s89 = 89,
        s90 = 90, s91 = 91, s92 = 92, s93 = 93, s94 = 94, s95 = 95, s96 = 96, s97 = 97, s98 = 98, s99 = 99,
        s100 = 100, s101 = 101, s102 = 102, s103 = 103, s104 = 104, s105 = 105, s106 = 106, s107 = 107, s108 = 108, s109 = 109,
        s110 = 110, s111 = 111, s112 = 112, s113 = 113, s114 = 114, s115 = 115, s116 = 116, s117 = 117, s118 = 118, s119 = 119,
        s120 = 120, s121 = 121, s122 = 122, s123 = 123, s124 = 124, s125 = 125, s126 = 126, s127 = 127, s128 = 128, s129 = 129,
        s130 = 130, s131 = 131, s132 = 132, s133 = 133, s134 = 134, s135 = 135, s136 = 136, s137 = 137, s138 = 138, s139 = 139,
        s140 = 140, s141 = 141, s142 = 142, s143 = 143, s144 = 144, s145 = 145, s146 = 146, s147 = 147, s148 = 148, s149 = 149,
        s150 = 150, s151 = 151, s152 = 152, s153 = 153, s154 = 154, s155 = 155, s156 = 156, s157 = 157, s158 = 158, s159 = 159,
        s160 = 160, s161 = 161, s162 = 162, s163 = 163, s164 = 164, s165 = 165, s166 = 166, s167 = 167, s168 = 168, s169 = 169,
        s170 = 170, s171 = 171, s172 = 172, s173 = 173, s174 = 174, s175 = 175, s176 = 176, s177 = 177, s178 = 178, s179 = 179,
        s180 = 180, s181 = 181, s182 = 182, s183 = 183, s184 = 184, s185 = 185, s186 = 186, s187 = 187, s188 = 188, s189 = 189,
        s190 = 190, s191 = 191, s192 = 192, s193 = 193, s194 = 194, s195 = 195, s196 = 196, s197 = 197, s198 = 198, s199 = 199,
        s200 = 200, s201 = 201, s202 = 202, s203 = 203, s204 = 204, s205 = 205, s206 = 206, s207 = 207, s208 = 208, s209 = 209,
        s210 = 210, s211 = 211, s212 = 212, s213 = 213, s214 = 214, s215 = 215, s216 = 216, s217 = 217, s218 = 218, s219 = 219,
        s220 = 220, s221 = 221, s222 = 222, s223 = 223, s224 = 224, s225 = 225, s226 = 226, s227 = 227, s228 = 228, s229 = 229,
        s230 = 230, s231 = 231, s232 = 232, s233 = 233, s234 = 234, s235 = 235, s236 = 236, s237 = 237, s238 = 238, s239 = 239,
        s240 = 240, s241 = 241, s242 = 242, s243 = 243, s244 = 244, s245 = 245, s246 = 246, s247 = 247, s248 = 248, s249 = 249,
        s250 = 250, s251 = 251, s252 = 252, s253 = 253
    };

    /// <summary>
    /// Helper class for enumerating NodeState
    /// </summary>
    public static class NodeStateHelper
    {
        public static string ToString(NodeState value)
        {
            switch ((long)value)
            {
                case 0: return "";
                case -1: return "-";
                default: return ((long)value).ToString();
            }
        }

        public static Color GetVertexRenderColor(NodeState state)
        {
            Color col = Colors.Lime;
            // byte state6bit = (byte)(((byte)state) % 4);
            switch ((byte)state % 16)
            {
                case 1:
                    col = Colors.Pink;
                    break;
                case 2:
                    col = Colors.Red;
                    break;
                case 3:
                    col = Colors.OrangeRed;
                    break;
                case 4:
                    col = Colors.Orange;
                    break;
                case 5:
                    col = Colors.LightYellow;
                    break;
                case 6:
                    col = Colors.Yellow;
                    break;
                case 7:
                    col = Colors.LightGreen;
                    break;
                case 8:
                    col = Colors.Green;
                    break;
                case 9:
                    col = Colors.LightSeaGreen;
                    break;
                case 10:
                    col = Colors.SeaGreen;
                    break;
                case 11:
                    col = Colors.LightBlue;
                    break;
                case 12:
                    col = Colors.Blue;
                    break;
                case 13:
                    col = Colors.Violet;
                    break;
                case 14:
                    col = Colors.LightCyan;
                    break;
                case 15:
                    col = Colors.White;
                    break;
                case 0:
                    col = Colors.LightGray;
                    break;
                case -1:
                    col = Colors.LightYellow;
                    break;
                default:
                    col = Colors.Gray;
                    break;
            }
            return col;
        }

        public static Color GetVertexRenderTextColor(NodeState state)
        {
            Color txtCol = Colors.White;
            switch ((int)state % 16)
            {
                case 2:
                    txtCol = Colors.Black;
                    break;
                case 3:
                    txtCol = Colors.Black;
                    break;
                case 5:
                    txtCol = Colors.Black;
                    break;
                case 7:
                    txtCol = Colors.Black;
                    break;
                case 0:
                    txtCol = Colors.Black;
                    break;
                case -1:
                    txtCol = Colors.Black;
                    break;
                default:
                    txtCol = Colors.White;
                    break;
            }
            return txtCol;
        }
    }

    /// <summary>
    /// Condition for executing an operation - for the transition table
    /// </summary>
    /// <remarks>
    /// The following types of conditions can exist:
    /// Examples:
    /// 1. The current state is equal to S1,
    ///    AND the previous state is S2,
    ///    AND the total number of connections is 1 (== less than or equal to 1 AND greater than or equal to 1)
    /// 2. The current state is equal to S1,
    ///    AND the previous state is none (== the node has just been born)
    ///    AND the number of incoming connections is less than or equal to "2"
    ///    AND the number of divisions is less than or equal to "5"
    /// 3. The current state is equal to S2,
    ///    the previous state is equal to S2
    ///    AND the total number of connections is greater than or equal to 4
    ///    AND the total number of connections is less than or equal to 2 (== blocked condition? No => ignore the condition for the total number of connections)
    /// 4. The current state is equal to S1
    ///    (the previous state is any)
    ///    That is, the condition description should include the following fields:
    ///    1. current state (mandatory value, (value > 0))
    ///    2. previous state (optional value, (value >= -1))
    ///    3. (optional):
    ///      3.1 (optional) total number of connections + greater than or equal to
    ///      3.2 (optional) total number of connections + less than or equal to
    ///      If none of the values fall under the condition,
    ///      it should be considered either optional or unachievable (global parameter)
    ///    // 4 (optional)
    ///    //  4.1 (optional) number of incoming connections + greater than or equal to
    ///    //  4.2 (optional) number of incoming connections + less than or equal to
    ///    // Completions call failed. Please try again.
    ///        ///      5.1 (optional) number of outgoing connections + greater than or equal to
    ///      5.2 (optional) number of outgoing connections + less than or equal to
    ///    6.1 (optional) number of parents + greater than or equal to
    ///    6.2 (optional) number of parents + less than or equal to
    ///
    ///    If the values of the fields
    ///        AllConnectionsCount_GE
    ///        AllConnectionsCount_LE
    ///        ParentCount_GE
    ///        ParentCount_LE
    ///        PriorState
    ///    are less than zero (-1), these parameters are ignored.
    ///
    ///    Example 1: condition for the current node
    ///    "previous state is equal to S1
    ///     AND the current state is equal to S2
    ///     AND the number of node connectors is less than two"
    ///    will be recorded as follows:
    ///    .CurrentState = S2
    ///    .PriorState = S1;
    ///    .AllConnectionsCount_LE = 1 // not 2, as less than or equal to 1 == less than 2
    ///    .AllConnectionsCount_GE = -1;
    ///    .ParentCount_GE = -1;
    ///    .ParentCount_LE = -1;
    ///
    ///    Example 2: condition
    ///    "current state is equal to S1
    ///    AND the number of node connectors is equal to three"
    ///    will be recorded as follows:
    ///    .CurrentState = S1
    ///    .PriorState = -1;
    ///    .AllConnectionsCount_LE = 3;
    ///    .AllConnectionsCount_GE = 3;
    ///    .ParentCount_GE = -1;
    ///    .ParentCount_LE = -1;
    ///
    ///    Example 3: condition
    ///    "current state is equal to S1
    ///    AND the cell has just been born"
    ///    will be recorded as follows:
    ///    .CurrentState = S1
    ///    .PriorState = 0;
    ///    .AllConnectionsCount_LE = -1;
    ///    .AllConnectionsCount_GE = -1;
    ///    .ParentCount_GE = -1;
    ///    .ParentCount_LE = -1;
    /// </remarks>
    /// <seealso cref="OperationKind"/>
    /// <seealso cref="Operation"/>
    public class OperationCondition
    {
        NodeState currentState;
        /// <summary>
        /// current state
        /// </summary>
        public NodeState CurrentState { get { return currentState; } set { currentState = value; } }

        NodeState _priorState;
        /// <summary>
        /// previous state
        /// </summary>
        public NodeState PriorState { get { return _priorState; } set { _priorState = value; } }

        int allConnectionsCount_GE;
        /// <summary>
        /// number of connections greater than (value)
        /// </summary>
        public int AllConnectionsCount_GE { get { return allConnectionsCount_GE; } set { allConnectionsCount_GE = value; } }

        int allConnectionsCount_LE;
        /// <summary>
        /// number of connections less than (value)
        /// </summary>
        public int AllConnectionsCount_LE { get { return allConnectionsCount_LE; } set { allConnectionsCount_LE = value; } }

        int parentsCount_GE;
        /// <summary>
        /// number of parents greater than (value)
        /// </summary>
        public int ParentsCount_GE { get { return parentsCount_GE; } set { parentsCount_GE = value; } }

        int parentsCount_LE;
        /// <summary>
        /// number of parents less than (value)
        /// </summary>
        public int ParentsCount_LE { get { return parentsCount_LE; } set { parentsCount_LE = value; } }

        /// <summary>
        /// Constructor
        /// </summary>
        public OperationCondition()
        {
            currentState = 0;
            _priorState = (NodeState)1;
            allConnectionsCount_GE = -1;
            allConnectionsCount_LE = -1;
            parentsCount_GE = -1;
            parentsCount_LE = -1;
        }
    }

    /// <summary>
    /// Type of operation
    /// </summary>
    public enum OperationKindEnum
    {
        /// <summary>transition to state</summary>
        TurnToState = 0x0,

        /// <summary>connect with nearest (not connected)</summary>
        TryToConnectWithNearest = 0x1,

        /// <summary>give birth to a new connected node</summary>
        GiveBirthConnected = 0x2,

        /// <summary>disconnect (from)</summary>
        DisconectFrom = 0x3,

        /// <summary>die (remove, self-destruct)</summary>
        Die = 0x4,

        /// <summary>try to connect (with)</summary>
        TryToConnectWith = 0x5,

        /// <summary>give birth to a new node</summary>
        GiveBirth = 0x6
    }

    /// <summary>
    /// Type of operation
    /// </summary>
    public static class OperationKindHelper
    {
        static public string ToString(OperationKindEnum _value)
        {
            switch (_value)
            {
                case OperationKindEnum.TurnToState:
                    return "Turn To State";
                case OperationKindEnum.TryToConnectWith:
                    return "Try To Connect With";
                case OperationKindEnum.TryToConnectWithNearest:
                    return "Try To Connect With nearest";
                case OperationKindEnum.GiveBirth:
                    return "Give Birth";
                case OperationKindEnum.GiveBirthConnected:
                    return "Give Birth (Connected)";
                case OperationKindEnum.Die:
                    return "Die";
                case OperationKindEnum.DisconectFrom:
                    return "Disconect From";
                default:
                    return _value.ToString();
            }
        }

        /// <summary>
        /// Operation requires operand.
        /// </summary>
        /// <returns></returns>
        static public bool IsNeedOperand(OperationKindEnum _value)
        {
            switch (_value)
            {
                case OperationKindEnum.TurnToState:
                    return true;
                case OperationKindEnum.TryToConnectWith:
                    return true;
                case OperationKindEnum.TryToConnectWithNearest:
                    return true;
                case OperationKindEnum.GiveBirth:
                    return false;
                case OperationKindEnum.GiveBirthConnected:
                    return false;
                case OperationKindEnum.Die:
                    return false;
                case OperationKindEnum.DisconectFrom:
                    return false;
                default:
                    return false;
            }
        }
    }

    /// <summary>
    /// Operation on a cell (action)
    /// </summary>
    public class Operation
    {
        OperationKindEnum _kind;
        /// <summary>type of operation, required value</summary>
        public OperationKindEnum Kind { get { return _kind; } set { _kind = value; } }

        NodeState _operandNodeState;
        /// <summary>operation parameter (so far only one - node state.)</summary>
        public NodeState OperandNodeState { get { return _operandNodeState; } set { _operandNodeState = value; } }

        public Operation()
        {
            _kind = OperationKindEnum.TurnToState;
            _operandNodeState = NodeState.Ignored;
        }

        public Operation(OperationKindEnum kind, NodeState operandNodeState)
        {
            _kind = kind;
            _operandNodeState = operandNodeState;
        }
    }

    /// <summary>
    /// Element of the transition rules table from one node state to another (grammar element, "gene")
    /// </summary>
    public class ChangeTableItem
    {
        /// <summary>
        /// Activity of the "gene" (transition rule). Set to true if the transition rule was triggered during the next iteration of the graph unfolding
        /// </summary>
        public bool IsActive = false;

        public bool WasActive = false;
        /// <summary>
        /// Inclusion of the "gene". Set to false if the gene needs to be turned off
        /// </summary>
        public bool IsEnabled = true;

        /// <summary>
        /// Activation index of the last activation.
        /// The difference between the current iteration number of the graph unfolding and this value shows
        /// how long ago the "gene" was activated.
        /// Equals -1 if it has never been activated
        /// </summary>
        public int LastActivationInterationIndex = -1;

        OperationCondition _condition;
        /// <summary>
        /// Operation condition
        /// </summary>
        public OperationCondition Condition { get { return _condition; } set { _condition = value; } }

        Operation _operation;
        /// <summary>
        /// Operation
        /// </summary>
        public Operation Operation { get { return _operation; } set { _operation = value; } }

        public ChangeTableItem()
        {
            _condition = null;
            _operation = null;
        }

        public ChangeTableItem(OperationCondition condition, Operation operation)
        {
            _condition = condition;
            _operation = operation;
        }

        /// <summary>
        /// Returns true if
        /// </summary>
        /// <param name="item"></param>
        /// <returns></returns>
        public bool ConditionIsMet(ChangeTableItem item)
        {
            return true;
        }

        public override string ToString()
        {
            string s;
            s = String.Format("Current: {0}; Prior: {1}; → Operation: {2}; Operand: {3}",
                Condition.CurrentState.ToString(),
                Condition.PriorState.ToString(),
                Operation.Kind.ToString(),
                Operation.OperandNodeState.ToString());

            return s;
        }
    }

    /// <summary>
    /// Node (vertex) of the graph for the graph unfolding machine
    /// </summary>
    public partial class GUMNode : Physical2DGraphVertex
    {
        // -- protected
        protected internal bool markedAsNew = true;
        protected internal NodeState state;
        // fixed parameters of the state at the previous step
        protected internal NodeState saved_State;
        protected internal NodeState saved_PriorState;
        protected internal int saved_ParentsCount;
        protected internal int _saved_ConnectionsCount;
        protected internal bool markedAsDeleted = false;
        protected internal int parentsCount;
        protected internal bool markedForCutUp = false;
        // for transferring the position of the parent node
        protected internal GUMNode parentNode;
        public GUMNode ParentNode { get { return parentNode; } }
        // for topological distance algorithms
        protected internal int distance;
        // index for reading the table
        protected internal int changeTableReadingIndex = 0;

        // -- protected methods
        protected internal void SaveStateParametres()
        {
            markedAsNew = false;
            saved_State = state;
            saved_PriorState = priorState;
            saved_ParentsCount = parentsCount;
            _saved_ConnectionsCount = ConnectionsCount;
        }

        #region public properties
        /// <summary>
        /// Node state
        /// </summary>
        public NodeState State { get { return state; } set { state = value; } }

        protected internal NodeState priorState;
        /// <summary>
        /// Previous node state
        /// </summary>
        public NodeState PriorState { get { return priorState; } set { priorState = value; } }

        /// <summary>
        /// Number of parents
        /// </summary>
        public int ParentsCount { get { return parentsCount; } }
        #endregion

        // -- public methods
        #region public methods
        public GUMNode()
        {
            state = NodeState.Unknown;
            priorState = NodeState.Unknown;
            parentsCount = 0;
            markedAsDeleted = false;
        }

        public GUMNode(NodeState state)
        {
            this.state = state;
            priorState = NodeState.Unknown;
            parentsCount = 0;
            markedAsDeleted = false;
        }

        /// <summary>
        /// Display "grammar item" (rule as a string)
        /// </summary>
        /// <returns></returns>
        public override string ToString()
        {
            if (Tag == null)
            {
                string result = String.Format("State: {0}; Prior State: {1}; Connections: {2}; Parents{3}; Pos: ({4:F1};{5:F1})",
                    NodeStateHelper.ToString(state),
                    NodeStateHelper.ToString(priorState),
                    ConnectionsCount,
                    parentsCount,
                    position.X,
                    position.Y);
                return result;
            }
            else
            {
                return base.ToString();
            }
        }
        #endregion
    }

    /// <summary>
    /// Transition table of the network finite automaton. Essentially, the "gene" of the graph, which contains all the information necessary for its unfolding.
    /// </summary>
    /// <remarks>
    /// Contains an ordered list of transitions
    /// - may contain duplicate elements
    /// - search is performed by parameters that meet the conditions (but not necessarily equal)
    /// </remarks>
    public class ChangeTable : System.Collections.Generic.List<ChangeTableItem>
    {
        /// <summary>
        /// Hash table element ("chain")
        /// </summary>
        internal class ConditionHashtableItem : IComparable
        {
            public NodeState hashValue;
            public List<ChangeTableItem> conditions = new List<ChangeTableItem>();

            public ConditionHashtableItem(NodeState hash)
            {
                this.hashValue = hash;
            }

            int IComparable.CompareTo(object obj)
            {
                if (obj is ConditionHashtableItem)
                {
                    return this.hashValue.CompareTo((obj as ConditionHashtableItem).hashValue);
                }
                else
                {
                    return int.MinValue;
                }
            }
        }

        /// <summary>
        /// Hash table for faster search if the ChangeTable is long enough.
        /// The current state of the node is used as a hash
        /// </summary>
        List<ConditionHashtableItem> myHashTable = new List<ConditionHashtableItem>();

        /// <summary>
        /// Adding a new element (transition rule) to the transition table
        /// </summary>
        /// <param name="condition">Condition</param>
        /// <param name="operation">Action</param>
        public void Add(OperationCondition condition, Operation operation)
        {
            ChangeTableItem cti = new ChangeTableItem(condition, operation);
            Add(cti);
        }

        /// <summary>
        /// Adding a new element (transition rule)
        /// </summary>
        /// <param name="currentState">Condition: current state</param>
        /// <param name="priorState">Condition: previous state</param>
        /// <param name="allConncetionsCountGE">Condition: number of connections greater than</param>
        /// <param name="allConncetionsCountLE">Condition: number of connections less than</param>
        /// <param name="parentsCountGE">Condition: number of parents greater than</param>
        /// <param name="parentsCountLE">Condition: number of parents less than</param>
        /// <param name="operationKind">Action: type</param>
        /// <param name="operand">Action: operand</param>
        public void Add(NodeState currentState, NodeState priorState,
                        int allConnectionsCountGE, int allConncetionsCountLE,
                        int parentsCountGE, int parentsCountLE,
                        OperationKindEnum operationKind,
                        NodeState operand)
        {
            OperationCondition cond = new OperationCondition();
            cond.CurrentState = currentState;
            cond.PriorState = priorState;
            cond.AllConnectionsCount_GE = allConnectionsCountGE;
            cond.AllConnectionsCount_LE = allConncetionsCountLE;
            cond.ParentsCount_GE = parentsCountGE;
            cond.ParentsCount_LE = parentsCountLE;
            Operation oper = new Operation(operationKind, operand);
            Add(cond, oper);
            isPrepared = false;
        }

        /// <summary>
        /// Preparing for multiple searches on the fixed table - building hash tables
        /// </summary>
        public void PrepareForSearch()
        {
            if (this.Count > 32)
            {
                // load the hash table
                myHashTable.Clear();
                myHashTable.Sort();
                foreach (ChangeTableItem ci in this)
                {
                    int ind;
                    ind = myHashTable.BinarySearch(new ConditionHashtableItem(ci.Condition.CurrentState));
                    ConditionHashtableItem hashTableItem;
                    if (ind < 0)
                    {
                        // add a new item to the hash table
                        hashTableItem = new ConditionHashtableItem(ci.Condition.CurrentState);
                        myHashTable.Insert(-ind - 1, hashTableItem);
                    }
                    else
                    {
                        hashTableItem = myHashTable[ind];
                    }
                    // expand the chain
                    hashTableItem.conditions.Add(ci);
                }
                isPrepared = true;
            }
        }

        protected bool isPrepared = false;

        /// <summary>
        /// Search for a table item (condition -> operation) by the unfolding graph vertex that meets the condition for performing the table item operation
        /// </summary>
        /// <param name="node">graph vertex</param>
        /// <returns>table item (condition -> operation)</returns>
        public ChangeTableItem Find(GUMNode node, CountComparerType countComparerType, TranscriptionWay transcriptionWay)
        {
            int foundIndex;
            ChangeTableItem result = Find(node, node.State, node.PriorState, node.ConnectionsCount, node.ParentsCount, node.changeTableReadingIndex, countComparerType, transcriptionWay, out foundIndex);
            if (foundIndex == this.Count - 1)
            {
                node.changeTableReadingIndex = 0;
            }
            else
            {
                node.changeTableReadingIndex = foundIndex + 1;
            }
            return result;
        }

        /// <summary>
        /// Search for a table rule item (condition --> operation) by node parameters that meet the condition for performing the item operation
        /// </summary>
        /// <param name="nodeState">current node state</param>
        /// <param name="priorNodeState">previous node state (at the previous step)</param>
        /// <param name="connectionsCount">number of connections (edges)</param>
        /// <param name="parentsCount">number of parents</param>
        /// <returns></returns>
        public ChangeTableItem Find(GUMNode node, NodeState nodeState, NodeState priorNodeState, int connectionsCount, int parentsCount, int changeTableReadingIndex, CountComparerType countComparerType, TranscriptionWay transcriptionWay, out int foundIndex)
        {
            if (transcriptionWay == TranscriptionWay.Resettable)
            {
                #region Reading the "genome" (rules table) always starts from the beginning. Binary search can be used
                                foundIndex = 0;
                if ((isPrepared) && (nodeState != NodeState.Min))
                {
                    #region
                    int chi_index;
                    chi_index = myHashTable.BinarySearch(new ConditionHashtableItem(nodeState));
                    if (chi_index < 0)
                    {
                        return null;
                    }
                    else
                    {
                        // found a chain by hash. Now scan the chain to find the first suitable condition
                        ConditionHashtableItem hashTableItem = myHashTable[chi_index];
                        foreach (ChangeTableItem tableItem in hashTableItem.conditions)
                        {
                            bool result = true;
                            OperationCondition condition = tableItem.Condition;

                            #region classic
                            result = (result && tableItem.IsEnabled);
                            result = (result && (condition.CurrentState == nodeState));
                            result = (result && ((condition.PriorState == priorNodeState) || (condition.PriorState == NodeState.Ignored)));
                            result = (result && ((condition.AllConnectionsCount_GE <= connectionsCount) || (condition.AllConnectionsCount_GE == -1)));
                            result = (result && ((condition.AllConnectionsCount_LE >= connectionsCount) || (condition.AllConnectionsCount_LE == -1)));
                            result = (result && ((condition.ParentsCount_GE <= parentsCount) || (condition.ParentsCount_GE == -1)));
                            result = (result && ((condition.ParentsCount_LE >= parentsCount) || (condition.ParentsCount_LE == -1)));
                            #endregion

                            if (result)
                            {
                                return tableItem;
                            }
                        }
                        return null;
                    }
                    #endregion
                }
                else
                {
                    foreach (ChangeTableItem tableItem in this)
                    {
                        bool result = true;
                        OperationCondition condition = tableItem.Condition;

                        #region classic
                        result = (result && tableItem.IsEnabled);
                        result = (result && (condition.CurrentState == nodeState));
                        result = (result && ((condition.PriorState == priorNodeState) || (condition.PriorState == NodeState.Ignored)));
                        result = (result && ((condition.AllConnectionsCount_GE <= connectionsCount) || (condition.AllConnectionsCount_GE == -1)));
                        result = (result && ((condition.AllConnectionsCount_LE >= connectionsCount) || (condition.AllConnectionsCount_LE == -1)));
                        result = (result && ((condition.ParentsCount_GE <= parentsCount) || (condition.ParentsCount_GE == -1)));
                        result = (result && ((condition.ParentsCount_LE >= parentsCount) || (condition.ParentsCount_LE == -1)));
                        #endregion

                        if (result)
                        {
                            return tableItem;
                        }
                    }
                    return null;
                }
                #endregion
            }
            else
            {
                #region Reading the "genome" (rules table) continues from the last triggered rule for the specific node
                foundIndex = 0;
                bool isFound = false;
                for (int i = changeTableReadingIndex; i < this.Count; i++)
                {
                    ChangeTableItem tableItem = this[i];
                    OperationCondition condition = tableItem.Condition;

                    #region classic
                    bool result = true;
                    result = (result && tableItem.IsEnabled);
                    result = (result && (condition.CurrentState == nodeState));
                    result = (result && ((condition.PriorState == priorNodeState) || (condition.PriorState == NodeState.Ignored)));
                    result = (result && ((condition.AllConnectionsCount_GE <= connectionsCount) || (condition.AllConnectionsCount_GE == -1)));
                    result = (result && ((condition.AllConnectionsCount_LE >= connectionsCount) || (condition.AllConnectionsCount_LE == -1)));
                    result = (result && ((condition.ParentsCount_GE <= parentsCount) || (condition.ParentsCount_GE == -1)));
                    result = (result && ((condition.ParentsCount_LE >= parentsCount) || (condition.ParentsCount_LE == -1)));
                    #endregion

                    if (result)
                    {
                        foundIndex = i;
                        isFound = true;
                        break;
                    }
                }
                if (isFound)
                {
                    return this[foundIndex];
                }
                else
                {
                    foundIndex = this.Count - 1;
                    return null;
                }
                #endregion
            }
        }

        internal void Reset()
        {
            foreach (var tableItem in this)
            {
                tableItem.IsActive = false;
            }
        }
    }

    /// <summary>
    /// Graph for the Graph Unfolding Machine
    /// </summary>
    public class GUMGraph : Physical2DGraph.Physical2DGraph
    {
        /// <summary>
        /// Values to pass to the edge deletion predicate
        /// </summary>
        ///<seealso cref="edgeToDeletePredicate"/>
        private NodeState disconnectFromNodeState;
        private GUMNode disconnectFromNode;
        internal List<GUMNode> toCutUpNodesList = new List<GUMNode>();
        private int maxConnectionDistance = 2;
        /// <summary>Maximum distance at which nodes can connect when performing the TryToConnectWithNearest operation</summary>
        public int MaxConnectionDistance { get { return maxConnectionDistance; } set { maxConnectionDistance = value; } }

        private int maxConnectionCount = 16;
        public int MaxConnectionCount { get { return maxConnectionCount; } set { maxConnectionCount = value; } }

        protected int maxVerticesCount = 0; // no limit
        public int MaxVerticesCount { get { return maxVerticesCount; } set { maxVerticesCount = value; } }

        // -- protected
        /// <summary>
        /// Save the state of all nodes
        /// </summary>
        protected internal void SaveAllNodesStateParametres()
        {
            foreach (var vertex in this.Vertices)
            {
                ((GUMNode)vertex).SaveStateParametres();
            }
        }

        /// <summary>
        /// Returns the topologically nearest node in the specified state (the first one that comes across) to the given node
        /// </summary>
        /// <param name="node">The starting node</param>
        /// <param name="state">The state to search for</param>
        /// <returns>The nearest node in the specified state</returns>
        private GUMNode FindNearest(GUMNode node, NodeState state)
        {
            GUMNode result = null;
            /*
            * Current distance: 0
            * Add the node to the list of candidates with the distance
            *
            * While the list of candidates is not empty:
            *     current node - the last from the list of candidates
            *     for each neighbor of the current node:
            *         check if it is marked as processed (distance <> -1)
            *         check if the neighbor meets the conditions (status and not connected to the node)
            *         ((!nodeToConnect.markedAsNew) && (nodeToConnect.saved_State == operation.OperandNodeState) && (!node.markedAsDeleted))
            *
            *         if yes: exit, result equals the neighboring node
            *         if no:
            *             if the neighbor is not yet marked as added to the list of candidates (distance = -1)
            *             then add it to the list of candidates (distance = current node distance + 1)
            *
            */
            // Reset the attribute distance for all nodes
            foreach (var v in this.Vertices)
            {
                (v as GUMNode).distance = -1;
            }

            int currentDistance = 0;
            node.distance = currentDistance;
            List<GUMNode> candidates = new List<GUMNode>();
            candidates.Add(node);
            while ((candidates.Count > 0) && (result == null))
            {
                GUMNode currentNode = candidates.First<GUMNode>();
                foreach (var ed in this.AdjacentEdges(currentNode))
                {
                    GUMNode neighbor = ed.GetOtherVertex(currentNode as Physical2DGraphVertex) as GUMNode;
                    if (neighbor.distance == -1)
                    {
                        if ((!neighbor.markedAsNew) && (neighbor.saved_State == state) && (!node.markedAsDeleted) && (currentNode.distance != 0))
                        {
                            result = neighbor;
                            break;
                        }
                        else
                        {
                            // Temporary: restriction
                            // TODO: parameterize MaxConnectionDistance
                            // All nodes with a distance of no more than MaxConnectionDistance will be considered
                            if (currentNode.distance <= MaxConnectionDistance - 1)
                            {
                                neighbor.distance = currentNode.distance + 1;
                                candidates.Add(neighbor);
                            }
                        }
                    }
                }
                candidates.Remove(currentNode);
            }
            return result;
        }

        /// <summary>
        /// Perform an operation on a node
        /// </summary>
        /// <param name="node">node on which to perform the action</param>
        /// <param name="operation">operation</param>
        protected internal void DoOperation(GUMNode node, Operation operation)
        {
            switch (operation.Kind)
            {
                case OperationKindEnum.TurnToState:
                    node.State = operation.OperandNodeState;
                    break;
                case OperationKindEnum.TryToConnectWith:
                    foreach (var vertex in Vertices)
                    {
                        GUMNode nodeToConnect = (GUMNode)vertex;
                        if ((!nodeToConnect.markedAsNew) && (nodeToConnect.saved_State == operation.OperandNodeState) && (!node.markedAsDeleted))
                        {
                            if ((nodeToConnect != node) && (node.ConnectionsCount <= MaxConnectionCount) && (nodeToConnect.ConnectionsCount <= MaxConnectionCount))
                            {
                                this.AddEdge(new Physical2DGraph.Physical2DGraphEdge<Physical2DGraphVertex>(node, nodeToConnect));
                            }
                        }
                    }
                    break;
                case OperationKindEnum.TryToConnectWithNearest:
                    GUMNode nearestFoundNode = this.FindNearest(node, operation.OperandNodeState);
                    if ((nearestFoundNode != null) && (node.ConnectionsCount <= MaxConnectionCount) && (nearestFoundNode.ConnectionsCount <= MaxConnectionCount))
                    {
                        this.AddEdge(new Physical2DGraph.Physical2DGraphEdge<Physical2DGraphVertex>(node, nearestFoundNode));
                    }
                    break;
                case OperationKindEnum.GiveBirth:
                    if ((VertexCount < maxVerticesCount) || (maxVerticesCount == 0))
                    {
                        GUMNode newNode = new GUMNode();
                        this.AddVertex(newNode);
                        newNode.State = operation.OperandNodeState;
                        newNode.parentsCount = node.ParentsCount + 1;
                    }
                    break;
                case OperationKindEnum.GiveBirthConnected:
                    if ((node.ConnectionsCount <= MaxConnectionCount) && ((VertexCount < maxVerticesCount) || (maxVerticesCount == 0)))
                    {
                        GUMNode newNode = new GUMNode();
                        newNode.parentNode = node;
                        this.AddVertex(newNode);
                        newNode.State = operation.OperandNodeState;
                        newNode.parentsCount = node.ParentsCount + 1;
                        this.AddEdge(new Physical2DGraph.Physical2DGraphEdge<Physical2DGraphVertex>(newNode, node));
                    }
                    break;
                case OperationKindEnum.Die:
                    node.markedAsDeleted = true;
                    break;
                case OperationKindEnum.DisconectFrom:
                    disconnectFromNodeState = operation.OperandNodeState;
                    disconnectFromNode = node;
                    this.RemoveAdjacentEdgeIf(node, edgeToDeletePredicate);
                    break;
                default:
                    break;
            }
        }

        /// <summary>
        /// Deletion predicate
        /// </summary>
        /// <param name="e"></param>
        /// <returns></returns>
        /// <seealso cref="disconnectFromNodeState"/>
        /// <seealso cref="disconnectFromNode"/>
        private bool edgeToDeletePredicate(Edge<Physical2DGraph.Physical2DGraphVertex> e)
        {
            bool result = false;
            GUMNode nodeToDisconnect = null;
            if (e.Source == disconnectFromNode)
            {
                nodeToDisconnect = (GUMNode)e.Target;
            }
            else
            {
                nodeToDisconnect = (GUMNode)e.Source;
            }
            if (nodeToDisconnect != null)
            {
                if ((!nodeToDisconnect.markedAsNew) && (nodeToDisconnect.saved_State == disconnectFromNodeState) && (!disconnectFromNode.markedAsDeleted))
                {
                    result = true;
                }
            }
            return result;
        }

        private bool edgeToDeletePredicate2(Edge<Physical2DGraph.Physical2DGraphVertex> e)
        {
            return true;
        }

        protected internal void DeleteMarkedAsDeletedNodes()
        {
            int nodesCount;
            nodesCount = this.VertexCount;
            Physical2DGraphVertex[] vertices;
            vertices = this.Vertices.ToArray<Physical2DGraphVertex>();
            for (int i = 0; i < nodesCount; i++)
            {
                Physical2DGraphVertex vertex;
                vertex = (Physical2DGraphVertex)vertices.GetValue(i);
                if (((GUMNode)vertex).markedAsDeleted)
                {
                    this.RemoveVertex(vertex);
                }
            }
        }

        public override void CutUpEdge(Physical2DGraphEdge<Physical2DGraphVertex> edge)
        {
            base.CutUpEdge(edge);
            toCutUpNodesList.Add((GUMNode)edge.Source);
            toCutUpNodesList.Add((GUMNode)edge.Target);
        }

        internal void CutUpVertexFromRoot(GUMNode node)
        {
            if (node.ParentsCount == 0)
            {
                return;
            }
            Physical2DGraph.Physical2DGraphVertex[] vertices = this.Vertices.ToArray<Physical2DGraph.Physical2DGraphVertex>();
            for (int i = 0; i < vertices.Length; i++)
            {
                GUMNode n = (GUMNode)vertices[i];
                n.markedForCutUp = false;
            }
            bool parentIsFound = false;
            List<GUMNode> candidates = new List<GUMNode>();
            node.markedForCutUp = true;
            candidates.Add(node);
            while ((candidates.Count > 0) && (parentIsFound == false))
            {
                GUMNode currentNode = candidates.First<GUMNode>();
                foreach (var ed in this.AdjacentEdges(currentNode))
                {
                    GUMNode neighbor = ed.GetOtherVertex(currentNode as Physical2DGraphVertex) as GUMNode;
                    if (neighbor.markedForCutUp == false)
                    {
                        if (neighbor.parentsCount == 0)
                        {
                            parentIsFound = true;
                            break;
                        }
                        else
                        {
                            neighbor.markedForCutUp = true;
                            candidates.Add(neighbor);
                        }
                    }
                }
                candidates.Remove(currentNode);
            }
            if (!parentIsFound)
            {
                for (int i = 0; i < vertices.Length; i++)
                {
                    GUMNode n = (GUMNode)vertices[i];
                    if (n.markedForCutUp)
                    {
                        n.markedAsDeleted = true;
                        this.RemoveAdjacentEdgeIf(vertices[i], edgeToDeletePredicate2);
                        n.State = (NodeState)(255);
                    }
                }
            }
            for (int i = 0; i < vertices.Length; i++)
            {
                GUMNode n = (GUMNode)vertices[i];
                n.markedForCutUp = false;
            }
        }

        /// <summary>
        /// Deleting all nodes "disconnected" from the root
        /// </summary>
        internal void DeleteVertexDisconnectedFromRoot()
        {
            Physical2DGraph.Physical2DGraphVertex[] vertices = this.Vertices.ToArray<Physical2DGraph.Physical2DGraphVertex>();
            foreach (GUMNode n in vertices)
            {
                n.markedForCutUp = true;
            }
            List<GUMNode> candidates = new List<GUMNode>();
            GUMNode root = (GUMNode)vertices.First();
            root.markedForCutUp = false;
            candidates.Add(root);
            while ((candidates.Count > 0))
            {
                GUMNode currentNode = candidates.First<GUMNode>();
                foreach (var ed in this.AdjacentEdges(currentNode))
                {
                    GUMNode neighbor = ed.GetOtherVertex(currentNode as Physical2DGraphVertex) as GUMNode;
                    if (neighbor.markedForCutUp == true)
                    {
                        neighbor.markedForCutUp = false;
                        candidates.Add(neighbor);
                    }
                }
                candidates.Remove(currentNode);
            }
            foreach (GUMNode n in vertices)
            {
                if (n.markedForCutUp)
                {
                    n.markedAsDeleted = true;
                    this.RemoveAdjacentEdgeIf(n, edgeToDeletePredicate2);
                    n.State = (NodeState)(255);
                }
            }
            foreach (GUMNode n in vertices)
            {
                n.markedForCutUp = false;
            }
        }
    }

    /// <summary>
    /// Method for comparing the number of (connections/parents) with the conditions for the operation
    /// </summary>
    public enum CountComparerType
    {
        /// <summary>
        /// Comparison by range.
        /// The operation condition "fits" the current node if the number of its connections falls within the range of the operation condition ConnectionCount_GE, ConnectionCount_LE,
        /// </summary>
        ByRange = 0,
        /// <summary>
        /// Exact comparison.
        /// The operation condition "fits" the current node if the number of its connections is equal to the operation condition range: Node.Connection = ConnectionCount_GE
        /// </summary>
        Exact = 1
    }

    /// <summary>
    /// Method of "reading" the transition rules table (searching for a rule suitable for the conditions)
    /// </summary>
    public enum TranscriptionWay
    {
        /// <summary>
        /// Reading the transition rules table always starts from the beginning. Thus,
        /// even if the transition rules table has several suitable rules (condition + operation),
        /// the operation of the first rule will always be chosen for performing the operation on the graph
        /// </summary>
        Resettable = 0,
        /// <summary>
        /// Reading the table continues from the next rule after the rule that triggered
        /// for a specific node during the previous iteration of the GUM machine. Thus, if the transition rules
        /// table contains several suitable rules for a node (and the state of the node after the first rule changes not so much
        /// to satisfy other suitable rules) - they will all trigger.
        /// </summary>
        Continuable = 1
    }

    /// <summary>
    /// Graph Unfolding Machine (Finite Automaton on graph nodes)
    /// </summary>
    public class GraphUnfoldingMachine
    {
        private Random rnd;
        internal ChangeTable changeTable;
        /// <summary>
        /// transition table (conditions - operation) - essentially the "genetic code" of the graph.
        /// </summary>
        /// <remarks>
        /// GraphUnfoldingMachine owns ChangeTable, creates it in the constructor
        /// </remarks>
        public ChangeTable ChangeTable { get { return changeTable; } set { changeTable = value; } }
        protected GUMGraph graph;
        public GUMGraph Graph { get { return graph; } }

        /// <summary>
        /// Iteration counter
        /// </summary>
        protected int passedStepsCount;
        public int PassedStepsCount { get { return passedStepsCount; } }
        protected int maxStepsCount;
        public int MaxStepsCount { get { return maxStepsCount; } set { maxStepsCount = value; } }
        protected TranscriptionWay transcriptionWay = TranscriptionWay.Resettable;
        public TranscriptionWay TranscriptionWay { get { return transcriptionWay; } set { transcriptionWay = value; } }
        /// <summary>
        /// Counter of iterations that passed without any operation on the nodes. Used for early exit
        /// </summary>
        int withoutAnyOperationStepsCounter = 0;
        /// <summary>
                /// <summary>
        /// Set after each iteration if there was at least one division operation. Used to maintain graph connectivity only when necessary
        /// </summary>
        bool isSomeDeleteOperationHaveBeen = false;
        /// <summary>
        /// Set after each iteration if there was at least one operation (any). Used to count empty iterations
        /// </summary>
        bool isSomeOperationHaveBeen = false;

        /// <summary>
        /// Flags and events for controlling the process
        /// </summary>
        protected bool isRunning;
        public bool IsRunning { get { return isRunning; } }
        protected bool toAbortFlag;
        public delegate void StopEventHandler(object sender, bool aborted);
        /// <summary>
        /// Event after the machine stops
        /// </summary>
        public event StopEventHandler StopEvent;

        public delegate void RunningFeedbackEventHandler(object sender, int passedStepsCount, int maxStepsCount);
        /// <summary>
        /// Event - calculation progress
        /// </summary>
        public event RunningFeedbackEventHandler RunningFeedbackEvent;
        public bool IsSlowDownModification;

        private CountComparerType countComparerType;
        public CountComparerType CountComparerType
        {
            get { return countComparerType; }
            set { countComparerType = value; }
        }

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="graph"></param>
        public GraphUnfoldingMachine(GUMGraph graph)
        {
            this.graph = graph;
            passedStepsCount = 0;
            toAbortFlag = false;
            maxStepsCount = -1;
            changeTable = new ChangeTable();
            rnd = new Random(1987);
        }

        /// <summary>
        /// Reset the machine
        /// </summary>
        public void Reset()
        {
            passedStepsCount = 0;
            graph.Reset();
        }

        /// <summary>  
        /// Start one iteration of the machine  
        /// </summary>  
        public void NextStep()  
        {  
            graph.SaveAllNodesStateParametres();  
            changeTable.Reset();  
            passedStepsCount += 1;  
            isSomeDeleteOperationHaveBeen = false;  
            isSomeOperationHaveBeen = false;  
            int nodesCount;  
            nodesCount = graph.VertexCount;  
            Physical2DGraphVertex[] vertices;  
            vertices = graph.Vertices.ToArray<Physical2DGraphVertex>();  
            for (int i = 0; i < nodesCount; i++)  
            {  
                Physical2DGraphVertex vertex;  
                vertex = (Physical2DGraphVertex)vertices.GetValue(i);  
                GUMNode node = (GUMNode)vertex;  
                if (node.state != (NodeState)255)  
                {  
                    ChangeTableItem changeTableItem = changeTable.Find(node, this.countComparerType, this.transcriptionWay);  
                    if (changeTableItem != null)  
                    {  
                        graph.DoOperation(node, changeTableItem.Operation);  
                        changeTableItem.IsActive = true;  
                        changeTableItem.WasActive = true;  
                        changeTableItem.LastActivationInterationIndex++;  
                        isSomeOperationHaveBeen = true;  
                        if (changeTableItem.Operation.Kind == OperationKindEnum.DisconectFrom)  
                        {  
                            isSomeDeleteOperationHaveBeen = true;  
                        }  
                    }  
                }  
                node.priorState = node.saved_State;  
            }  
        
            for (int i = 0; i < graph.toCutUpNodesList.Count; i++)  
            {  
                GUMNode nodeToCutUp = graph.toCutUpNodesList[i];  
                graph.CutUpVertexFromRoot(nodeToCutUp);  
            }  
            graph.toCutUpNodesList.Clear();  
        
            if (this.Support1Connected && isSomeDeleteOperationHaveBeen)  
            {  
                graph.DeleteVertexDisconnectedFromRoot();  
            }  
            if (!isSomeOperationHaveBeen)  
            {  
                this.withoutAnyOperationStepsCounter++;  
            }  
            graph.DeleteMarkedAsDeletedNodes();  
            DoOnRunningFeedBack();  
        }  

        /// <summary>
        /// Start
        /// </summary>
        public void Run()
        {
            if (!isRunning)
            {
                isRunning = true;
                toAbortFlag = false;
                passedStepsCount = 0;
                withoutAnyOperationStepsCounter = 0;
                ChangeTable.PrepareForSearch();
                while ((!toAbortFlag) && ((passedStepsCount < maxStepsCount) || (maxStepsCount < 0)) && (withoutAnyOperationStepsCounter < 2))
                {
                    NextStep();
                }
                DoOnStop();
                isRunning = false;
            }
        }

        #region event generators
        /// <summary>
        /// Generate the stop event (after Run)
        /// </summary>
        private void DoOnStop()
        {
            if (StopEvent != null)
            {
                StopEvent(this, toAbortFlag);
            }
        }

        /// <summary>
        /// Generate the calculation progress event
        /// </summary>
        private void DoOnRunningFeedBack()
        {
            if (RunningFeedbackEvent != null)
            {
                RunningFeedbackEvent(this, passedStepsCount, maxStepsCount);
            }
        }
        #endregion
        public bool Support1Connected { get; set; }
    }
}