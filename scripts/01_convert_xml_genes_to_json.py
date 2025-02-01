import xml.etree.ElementTree as ET
import json

def xml_to_json(xml_file):
    tree = ET.parse(xml_file)
    root = tree.getroot()

    genes = {}

    for change_table in root.findall("{clr-namespace:GraphUnfoldingMachine;assembly=Physical2DGraphCanvasSL}ChangeTable"):
        gene_name = change_table.get("{http://schemas.microsoft.com/winfx/2006/xaml}Key")
        genes[gene_name] = []

        for item in change_table.findall("{clr-namespace:GraphUnfoldingMachine;assembly=Physical2DGraphCanvasSL}ChangeTableItem"):
            condition = item.find("{clr-namespace:GraphUnfoldingMachine;assembly=Physical2DGraphCanvasSL}ChangeTableItem.Condition/{clr-namespace:GraphUnfoldingMachine;assembly=Physical2DGraphCanvasSL}OperationCondition")
            operation = item.find("{clr-namespace:GraphUnfoldingMachine;assembly=Physical2DGraphCanvasSL}ChangeTableItem.Operation/{clr-namespace:GraphUnfoldingMachine;assembly=Physical2DGraphCanvasSL}Operation")

            condition_data = {
                "currentState": condition.get("CurrentState"),
                "priorState": condition.get("PriorState"),
                "allConnectionsCount_GE": int(condition.get("AllConnectionsCount_GE")),
                "allConnectionsCount_LE": int(condition.get("AllConnectionsCount_LE")),
                "parentsCount_GE": int(condition.get("ParentsCount_GE")),
                "parentsCount_LE": int(condition.get("ParentsCount_LE"))
            }

            operation_data = {
                "kind": operation.get("Kind"),
                "operandNodeState": operation.get("OperandNodeState")
            }

            genes[gene_name].append({
                "condition": condition_data,
                "operation": operation_data
            })

    return json.dumps({"genes": genes}, indent=4)

# Example usage:
xml_file = "/Users/rgudchenko/p/GUCA/2024_10_28_CSharp_backup/GUCA_DemoSL/GUCA_DemoSL/GUCA_DemoSLApplication/dictGens.xaml"
json_data = xml_to_json(xml_file)
with open("../data/demo_2010_dict_genes.json", "w") as json_file:
    json_file.write(json_data)