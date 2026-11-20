from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import joblib
import os

app = Flask(__name__)
CORS(app)  # Permite que tu Live Server se comunique con Python sin bloqueos del navegador

# 1. Cargar el modelo de IA entrenado y la base de datos limpia
modelo = joblib.load('modelo_diseb.pkl') if os.path.exists('modelo_diseb.pkl') else None
base_datos = pd.read_csv('datos_de_prueba_limpios.csv') if os.path.exists('datos_de_prueba_limpios.csv') else None

# Diccionarios para traducir las opciones de tu HTML a los números que espera la IA
diccionario_marcas = {"Ford": 3, "Volkswagen": 18, "BYD": 0, "Nissan": 16, "Tata": 1, "BMW": 5, "Hyundai": 4, "Renault": 6}
quimica_dict = {"NMC": 0, "LFP": 1, "LMO": 3, "NCA": 2, "LTO": 4}
regimen_dict = {"Private": 0, "Fleet": 1}
terreno_dict = {"Plano": 0, "Montaña": 1, "Costero": 2}

@app.route('/predict', methods=['POST'])
def predict():
    if not modelo or base_datos is None:
        return jsonify({"error": "Faltan archivos de modelo o base de datos."}), 500

    datos_html = request.json
    
    # Extraer valores numéricos y de texto enviados desde tu index.html
    anios_uso = int(datos_html.get('anios', 3))
    meses_adicionales = int(datos_html.get('meses', 0))
    odometro = float(datos_html.get('odometro', 85000))
    ciclos = float(datos_html.get('ciclos', 650))  # Si está en modo cliente, toma 650 por defecto
    
    meses_totales = (anios_uso * 12) + meses_adicionales
    descarga_estimada = min(95.0, 30.0 + (meses_totales * 0.4))
    
    # Preparar la fila utilizando la estructura de tu dataset limpio
    vehiculo_cliente = base_datos.drop(columns=['vehicle_id', 'battery_failure'], errors='ignore').iloc[[0]].copy()
    
    vehiculo_cliente['vehicle_brand'] = diccionario_marcas.get(datos_html.get('marca'), 3)
    vehiculo_cliente['odometer_km'] = odometro
    vehiculo_cliente['battery_chemistry'] = quimica_dict.get(datos_html.get('quimica'), 0)
    vehiculo_cliente['cycle_count'] = ciclos
    vehiculo_cliente['depth_of_discharge'] = descarga_estimada
    vehiculo_cliente['fleet_or_private'] = regimen_dict.get(datos_html.get('regimen'), 0)

    # --- LA PREDICCIÓN REAL DE LA INTELIGENCIA ARTIFICIAL ---
    prediccion_falla = int(modelo.predict(vehiculo_cliente)[0])
    soh_estimado = float(max(40.0, 96.0 - (ciclos / 35.0) - (odometro / 18000.0) - (meses_totales * 0.15)))
    
    # Regresar el resultado real a tu página web
    return jsonify({
        "soh_estimado": soh_estimado,
        "prediccion_falla": prediccion_falla,
        "anios": anios_uso,
        "meses": meses_adicionales
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)