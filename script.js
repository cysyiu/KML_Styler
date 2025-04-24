// Create an empty vector source for imported KML features.
var vectorSource = new ol.source.Vector();

// Create the vector layer without a general style function
// so that imported inline KML styles are used initially.
var vectorLayer = new ol.layer.Vector({
  source: vectorSource
});

// Initialize the map with a base OSM tile layer and the vector layer.
var map = new ol.Map({
  target: 'map',
  layers: [
    new ol.layer.Tile({ source: new ol.source.OSM() }),
    vectorLayer
  ],
  view: new ol.View({
    center: ol.proj.fromLonLat([0, 0]),
    zoom: 2
  })
});

// Store styles information
let styleData = {
  points: [],
  lines: [],
  polygons: []
};

// Convert a KML color (aabbggrr) to a standard hex color (#rrggbb).
// This also let us extract the alpha value from the first two digits.
function convertKmlToHex(kmlColor) {
  if (!kmlColor || kmlColor.length !== 8) return '#000000';
  var red   = kmlColor.substr(6, 2);
  var green = kmlColor.substr(4, 2);
  var blue  = kmlColor.substr(2, 2);
  return '#' + red + green + blue;
}

// Extract alpha value from KML color
function extractAlpha(kmlColor) {
  if (!kmlColor || kmlColor.length !== 8) return 1;
  return parseInt(kmlColor.substr(0, 2), 16) / 255;
}

// Helper function to convert hex color to an rgba string with the provided opacity.
function hexToRGBA(hex, opacity) {
  var r = parseInt(hex.substr(1, 2), 16);
  var g = parseInt(hex.substr(3, 2), 16);
  var b = parseInt(hex.substr(5, 2), 16);
  return "rgba(" + r + ", " + g + ", " + b + ", " + opacity + ")";
}

// Read styles from the imported KML and update the control panel.
function readKmlStyles(kmlText) {
  var parser = new DOMParser();
  var xmlDoc = parser.parseFromString(kmlText, 'text/xml');
  
  // Reset style data
  styleData = {
    points: [],
    lines: [],
    polygons: []
  };
  
  // Get all Style elements
  var styleElements = xmlDoc.getElementsByTagName('Style');
  
  for (let i = 0; i < styleElements.length; i++) {
    const styleElement = styleElements[i];
    const styleId = styleElement.getAttribute('id') || `style_${i+1}`;
    
    // Process IconStyle (Points)
    const iconStyle = styleElement.getElementsByTagName('IconStyle')[0];
    if (iconStyle) {
      let pointStyle = {
        id: styleId,
        iconUrl: "",
        iconScale: 1,
        iconHeading: 0,
        iconColor: "#ffffff",
        labelEnabled: false,
        labelColor: "#000000",
        labelScale: 1
      };
      
      // Extract icon URL
      const iconElem = iconStyle.getElementsByTagName('Icon')[0];
      if (iconElem) {
        const hrefElem = iconElem.getElementsByTagName('href')[0];
        if (hrefElem && hrefElem.textContent) {
          pointStyle.iconUrl = hrefElem.textContent.trim();
        }
      }
      
      // Extract scale
      const scaleElem = iconStyle.getElementsByTagName('scale')[0];
      if (scaleElem && scaleElem.textContent) {
        pointStyle.iconScale = parseFloat(scaleElem.textContent.trim());
      }
      
      // Extract heading
      const headingElem = iconStyle.getElementsByTagName('heading')[0];
      if (headingElem && headingElem.textContent) {
        pointStyle.iconHeading = parseFloat(headingElem.textContent.trim());
      }
      
      // Extract color
      const iconColorElem = iconStyle.getElementsByTagName('color')[0];
      if (iconColorElem && iconColorElem.textContent) {
        pointStyle.iconColor = convertKmlToHex(iconColorElem.textContent.trim());
      }
      
      // Check for LabelStyle
      const labelStyle = styleElement.getElementsByTagName('LabelStyle')[0];
      if (labelStyle) {
        pointStyle.labelEnabled = true;
        
        const labelColorElem = labelStyle.getElementsByTagName('color')[0];
        if (labelColorElem && labelColorElem.textContent) {
          pointStyle.labelColor = convertKmlToHex(labelColorElem.textContent.trim());
        }
        
        const labelScaleElem = labelStyle.getElementsByTagName('scale')[0];
        if (labelScaleElem && labelScaleElem.textContent) {
          pointStyle.labelScale = parseFloat(labelScaleElem.textContent.trim());
        }
      }
      
      styleData.points.push(pointStyle);
    }
    
    // Process LineStyle
    const lineStyle = styleElement.getElementsByTagName('LineStyle')[0];
    if (lineStyle) {
      let lineStyleData = {
        id: styleId,
        lineColor: "#000000",
        lineWidth: 1
      };
      
      const lineColorElem = lineStyle.getElementsByTagName('color')[0];
      if (lineColorElem && lineColorElem.textContent) {
        lineStyleData.lineColor = convertKmlToHex(lineColorElem.textContent.trim());
      }
      
      const widthElem = lineStyle.getElementsByTagName('width')[0];
      if (widthElem && widthElem.textContent) {
        lineStyleData.lineWidth = parseInt(widthElem.textContent.trim(), 10);
      }
      
      styleData.lines.push(lineStyleData);
    }
    
    // Process PolyStyle
    const polyStyle = styleElement.getElementsByTagName('PolyStyle')[0];
    if (polyStyle) {
      let polyStyleData = {
        id: styleId,
        fillColor: "#ffffff",
        fillOpacity: 1,
        polyFill: true,
        polyOutline: true,
        lineColor: "#000000",
        lineWidth: 1
      };
      
      const fillColorElem = polyStyle.getElementsByTagName('color')[0];
      if (fillColorElem && fillColorElem.textContent) {
        const kmlColor = fillColorElem.textContent.trim();
        polyStyleData.fillColor = convertKmlToHex(kmlColor);
        polyStyleData.fillOpacity = extractAlpha(kmlColor);
      }
      
      const fillElem = polyStyle.getElementsByTagName('fill')[0];
      if (fillElem && fillElem.textContent) {
        polyStyleData.polyFill = (parseInt(fillElem.textContent.trim(), 10) !== 0);
      }
      
      const outlineElem = polyStyle.getElementsByTagName('outline')[0];
      if (outlineElem && outlineElem.textContent) {
        polyStyleData.polyOutline = (parseInt(outlineElem.textContent.trim(), 10) !== 0);
      }
      
      // If there's a LineStyle, use it for the polygon outline
      if (lineStyle) {
        const lineColorElem = lineStyle.getElementsByTagName('color')[0];
        if (lineColorElem && lineColorElem.textContent) {
          polyStyleData.lineColor = convertKmlToHex(lineColorElem.textContent.trim());
        }
        
        const widthElem = lineStyle.getElementsByTagName('width')[0];
        if (widthElem && widthElem.textContent) {
          polyStyleData.lineWidth = parseInt(widthElem.textContent.trim(), 10);
        }
      }
      
      styleData.polygons.push(polyStyleData);
    }
  }
  
  // Generate the style controls
  generateStyleControls();
}

// Generate style control panels based on the styleData
function generateStyleControls() {
  const styleControls = document.getElementById('styleControls');
  styleControls.innerHTML = '';
  
  // If no styles found
  if (styleData.points.length === 0 && styleData.lines.length === 0 && styleData.polygons.length === 0) {
    styleControls.innerHTML = '<p class="no-styles">No styles found in the KML file</p>';
    return;
  }
  
  // Generate Point Style controls
  if (styleData.points.length > 0) {
    styleControls.innerHTML += '<div class="style-type-header">Point Styles</div>';
    
    styleData.points.forEach((pointStyle, index) => {
      const pointStyleHtml = `
        <div class="style-section" data-type="point" data-index="${index}" data-style-id="${pointStyle.id}">
          <h3>Style ID: ${pointStyle.id}</h3>
          <div class="form-group">
            <label for="iconUrl_${index}">Icon URL:</label>
            <input type="text" id="iconUrl_${index}" value="${pointStyle.iconUrl}" placeholder="Icon URL">
          </div>
          <div class="form-group">
            <label for="iconScale_${index}">Icon Scale:</label>
            <input type="number" id="iconScale_${index}" value="${pointStyle.iconScale}" step="0.1" min="0.1" placeholder="Icon Scale">
          </div>
          <div class="form-group">
            <label for="iconHeading_${index}">Icon Heading:</label>
            <input type="number" id="iconHeading_${index}" value="${pointStyle.iconHeading}" placeholder="Heading (deg)">
          </div>
          <div class="form-group">
            <label for="iconColor_${index}">Icon Color:</label>
            <input type="color" id="iconColor_${index}" value="${pointStyle.iconColor}">
          </div>
          <div class="form-group">
            <label for="labelEnabled_${index}">Enable Label:</label>
            <input type="checkbox" id="labelEnabled_${index}" ${pointStyle.labelEnabled ? 'checked' : ''} onchange="toggleLabelControls(${index})">
          </div>
          <div class="form-group label-controls-${index}" style="${!pointStyle.labelEnabled ? 'display:none;' : ''}">
            <label for="labelColor_${index}">Label Color:</label>
            <input type="color" id="labelColor_${index}" value="${pointStyle.labelColor}">
          </div>
          <div class="form-group label-controls-${index}" style="${!pointStyle.labelEnabled ? 'display:none;' : ''}">
            <label for="labelScale_${index}">Label Scale:</label>
            <input type="number" id="labelScale_${index}" value="${pointStyle.labelScale}" step="0.1" min="0.1" placeholder="Label Scale">
          </div>
        </div>
      `;
      styleControls.innerHTML += pointStyleHtml;
    });
  }
  
  // Generate Line Style controls
  if (styleData.lines.length > 0) {
    styleControls.innerHTML += '<div class="style-type-header">Line Styles</div>';
    
    styleData.lines.forEach((lineStyle, index) => {
      const lineStyleHtml = `
        <div class="style-section" data-type="line" data-index="${index}" data-style-id="${lineStyle.id}">
          <h3>Style ID: ${lineStyle.id}</h3>
          <div class="form-group">
            <label for="lineColor_${index}">Line Color:</label>
            <input type="color" id="lineColor_${index}" value="${lineStyle.lineColor}">
          </div>
          <div class="form-group">
            <label for="lineWidth_${index}">Line Width:</label>
            <input type="number" id="lineWidth_${index}" value="${lineStyle.lineWidth}" min="1" max="10" placeholder="Line Width">
          </div>
        </div>
      `;
      styleControls.innerHTML += lineStyleHtml;
    });
  }
  
  // Generate Polygon Style controls
  if (styleData.polygons.length > 0) {
    styleControls.innerHTML += '<div class="style-type-header">Polygon Styles</div>';
    
    styleData.polygons.forEach((polyStyle, index) => {
      const polyStyleHtml = `
        <div class="style-section" data-type="polygon" data-index="${index}" data-style-id="${polyStyle.id}">
          <h3>Style ID: ${polyStyle.id}</h3>
          <div class="form-group">
            <label for="fillColor_${index}">Fill Color:</label>
            <input type="color" id="fillColor_${index}" value="${polyStyle.fillColor}">
          </div>
          <div class="form-group">
            <label for="fillOpacity_${index}">Fill Opacity:</label>
            <input type="range" id="fillOpacity_${index}" min="0" max="1" step="0.1" value="${polyStyle.fillOpacity}"
                   oninput="document.getElementById('fillOpacityVal_${index}').textContent = this.value">
            <span id="fillOpacityVal_${index}">${polyStyle.fillOpacity}</span>
          </div>
          <div class="form-group">
            <label for="polyFill_${index}">Fill Enabled:</label>
            <input type="checkbox" id="polyFill_${index}" ${polyStyle.polyFill ? 'checked' : ''}>
          </div>
          <div class="form-group">
            <label for="polyOutline_${index}">Outline Enabled:</label>
            <input type="checkbox" id="polyOutline_${index}" ${polyStyle.polyOutline ? 'checked' : ''}>
          </div>
          <div class="form-group">
            <label for="polyLineColor_${index}">Outline Color:</label>
            <input type="color" id="polyLineColor_${index}" value="${polyStyle.lineColor}">
          </div>
          <div class="form-group">
            <label for="polyLineWidth_${index}">Outline Width:</label>
            <input type="number" id="polyLineWidth_${index}" value="${polyStyle.lineWidth}" min="1" max="10" placeholder="Line Width">
          </div>
        </div>
      `;
      styleControls.innerHTML += polyStyleHtml;
    });
  }
}

// Toggle label controls visibility
function toggleLabelControls(index) {
  const labelEnabled = document.getElementById(`labelEnabled_${index}`).checked;
  const labelControls = document.querySelectorAll(`.label-controls-${index}`);
  
  labelControls.forEach(control => {
    control.style.display = labelEnabled ? 'block' : 'none';
  });
}

// Update feature styles based on values in the control panel.
function updateStyle() {
  // Update styleData from form inputs
  updateStyleDataFromForm();
  
  // Create a style map to store updated styles by ID
  const styleMap = {};
  
  // Add point styles to the map
  styleData.points.forEach(pointStyle => {
    const iconOptions = {
      src: pointStyle.iconUrl,
      scale: pointStyle.iconScale,
      rotation: (pointStyle.iconHeading * Math.PI) / 180
    };
    
    const styleOptions = {
      image: new ol.style.Icon(iconOptions)
    };
    
    // Add text style if label is enabled
    if (pointStyle.labelEnabled) {
      styleOptions.text = new ol.style.Text({
        text: '${name}', // This will be replaced with the actual feature name
        font: `${12 * pointStyle.labelScale}px Arial`,
        fill: new ol.style.Fill({
          color: pointStyle.labelColor
        }),
        stroke: new ol.style.Stroke({
          color: '#ffffff',
          width: 2
        }),
        offsetY: -15
      });
    }
    
    styleMap[pointStyle.id] = new ol.style.Style(styleOptions);
  });
  
  // Add line styles to the map
  styleData.lines.forEach(lineStyle => {
    styleMap[lineStyle.id] = new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: lineStyle.lineColor,
        width: lineStyle.lineWidth
      })
    });
  });
  
  // Add polygon styles to the map
  styleData.polygons.forEach(polyStyle => {
    const rgbaFillColor = hexToRGBA(polyStyle.fillColor, polyStyle.fillOpacity);
    
    styleMap[polyStyle.id] = new ol.style.Style({
      fill: polyStyle.polyFill ? new ol.style.Fill({ color: rgbaFillColor }) : null,
      stroke: polyStyle.polyOutline ? new ol.style.Stroke({ 
        color: polyStyle.lineColor, 
        width: polyStyle.lineWidth 
      }) : null
    });
  });
  
  // Apply styles to features based on their styleUrl
  vectorSource.getFeatures().forEach(function(feature) {
    const styleUrl = feature.get('styleUrl');
    if (!styleUrl) return; // Skip features without style URL
    
    // Extract the style ID from the styleUrl
    // Handle both '#style-id' and 'file:///path/to/file.html#style-id' formats
    const styleId = styleUrl.split('#').pop();
    const style = styleMap[styleId];
    
    if (style) {
      // If the style has text, replace the template with the actual feature name
      if (style.getText()) {
        const textStyle = style.getText().clone();
        textStyle.setText(feature.get('name') || '');
        
        // Create a new style with the updated text
        const newStyle = style.clone();
        newStyle.setText(textStyle);
        
        feature.setStyle(newStyle);
      } else {
        feature.setStyle(style);
      }
    }
  });
}



// Update styleData from form inputs
function updateStyleDataFromForm() {
  // Update point styles
  styleData.points.forEach((pointStyle, index) => {
    pointStyle.iconUrl = document.getElementById(`iconUrl_${index}`).value;
    pointStyle.iconScale = parseFloat(document.getElementById(`iconScale_${index}`).value) || 1;
    pointStyle.iconHeading = parseFloat(document.getElementById(`iconHeading_${index}`).value) || 0;
    pointStyle.iconColor = document.getElementById(`iconColor_${index}`).value;
    pointStyle.labelEnabled = document.getElementById(`labelEnabled_${index}`).checked;
    
    if (pointStyle.labelEnabled) {
      pointStyle.labelColor = document.getElementById(`labelColor_${index}`).value;
      pointStyle.labelScale = parseFloat(document.getElementById(`labelScale_${index}`).value) || 1;
    }
  });
  
  // Update line styles
  styleData.lines.forEach((lineStyle, index) => {
    lineStyle.lineColor = document.getElementById(`lineColor_${index}`).value;
    lineStyle.lineWidth = parseInt(document.getElementById(`lineWidth_${index}`).value, 10) || 1;
  });
  
  // Update polygon styles
  styleData.polygons.forEach((polyStyle, index) => {
    polyStyle.fillColor = document.getElementById(`fillColor_${index}`).value;
    polyStyle.fillOpacity = parseFloat(document.getElementById(`fillOpacity_${index}`).value) || 1;
    polyStyle.polyFill = document.getElementById(`polyFill_${index}`).checked;
    polyStyle.polyOutline = document.getElementById(`polyOutline_${index}`).checked;
    polyStyle.lineColor = document.getElementById(`polyLineColor_${index}`).value;
    polyStyle.lineWidth = parseInt(document.getElementById(`polyLineWidth_${index}`).value, 10) || 1;
  });
}

// Convert styleData to KML style elements
function styleDataToKml() {
  let kmlStyles = '';
  
  // Process point styles
  styleData.points.forEach(pointStyle => {
    kmlStyles += `
      <Style id="${pointStyle.id}">
        <IconStyle>
          <color>${colorToKmlColor(pointStyle.iconColor, 1)}</color>
          <scale>${pointStyle.iconScale}</scale>
          <heading>${pointStyle.iconHeading}</heading>
          <Icon>
            <href>${pointStyle.iconUrl}</href>
          </Icon>
        </IconStyle>`;
    
    if (pointStyle.labelEnabled) {
      kmlStyles += `
        <LabelStyle>
          <color>${colorToKmlColor(pointStyle.labelColor, 1)}</color>
          <scale>${pointStyle.labelScale}</scale>
        </LabelStyle>`;
    } else {
      kmlStyles += `
        <LabelStyle>
          <scale>0</scale>
        </LabelStyle>`;
    }
    
    kmlStyles += `
      </Style>`;
  });
  
  // Process line styles
  styleData.lines.forEach(lineStyle => {
    kmlStyles += `
      <Style id="${lineStyle.id}">
        <LineStyle>
          <color>${colorToKmlColor(lineStyle.lineColor, 1)}</color>
          <width>${lineStyle.lineWidth}</width>
        </LineStyle>
      </Style>`;
  });
  
  // Process polygon styles
  styleData.polygons.forEach(polyStyle => {
    kmlStyles += `
      <Style id="${polyStyle.id}">
        <PolyStyle>
          <color>${colorToKmlColor(polyStyle.fillColor, polyStyle.fillOpacity)}</color>
          <fill>${polyStyle.polyFill ? 1 : 0}</fill>
          <outline>${polyStyle.polyOutline ? 1 : 0}</outline>
        </PolyStyle>`;
    
    if (polyStyle.polyOutline) {
      kmlStyles += `
        <LineStyle>
          <color>${colorToKmlColor(polyStyle.lineColor, 1)}</color>
          <width>${polyStyle.lineWidth}</width>
        </LineStyle>`;
    }
    
    kmlStyles += `
      </Style>`;
  });
  
  return kmlStyles;
}

// Convert hex color to KML color format (aabbggrr)
function colorToKmlColor(hexColor, opacity) {
  // Remove # if present
  hexColor = hexColor.replace('#', '');
  
  // Convert hex to rgb
  const r = hexColor.substr(0, 2);
  const g = hexColor.substr(2, 2);
  const b = hexColor.substr(4, 2);
  
  // Convert opacity to hex
  const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
  
  // Return KML color format (aabbggrr)
  return alpha + b + g + r;
}

// Export the updated features (with inline styles) as a KML file.
function exportKML() {
  // Update styleData from form inputs
  updateStyleDataFromForm();
  
  // Apply styles to features
  updateStyle();
  
  // Get features
  var features = vectorSource.getFeatures();
  
  // Create KML document
  let kmlString = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>KML Export</name>
    <description>Exported from KML Style Editor</description>
    ${styleDataToKml()}`;
  
  // Add features to KML
  const kmlFormat = new ol.format.KML();
  const featuresKml = kmlFormat.writeFeatures(features, {
    featureProjection: 'EPSG:3857',
    dataProjection: 'EPSG:4326'
  });
  
  // Extract just the Placemark elements from the features KML
  const parser = new DOMParser();
  const featuresDoc = parser.parseFromString(featuresKml, 'text/xml');
  const placemarks = featuresDoc.getElementsByTagName('Placemark');
  
  for (let i = 0; i < placemarks.length; i++) {
    const placemark = placemarks[i];
    const placemarkXml = new XMLSerializer().serializeToString(placemark);
    kmlString += placemarkXml;
  }
  
  // Close KML document
  kmlString += `
  </Document>
</kml>`;
  
  // Create a Blob and trigger a download.
  var blob = new Blob([kmlString], {type: 'application/vnd.google-earth.kml+xml'});
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.href = url;
  link.download = 'updated_features.kml';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Listen for file selections to import a KML file.
document.getElementById('kmlFileInput').addEventListener('change', function(event) {
  var file = event.target.files[0];
  if (file) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var kmlText = e.target.result;
      
      // Populate the control panel with styles from the imported KML.
      readKmlStyles(kmlText);
      
      // Parse the features from the KML text with inline styles.
      var features = new ol.format.KML({
        extractStyles: true
      }).readFeatures(kmlText, {
        featureProjection: 'EPSG:3857'
      });
      
      // Clear any existing features and add the new ones.
      vectorSource.clear();
      vectorSource.addFeatures(features);
      
      // Zoom to the extent of the imported features.
      if (features.length) {
        var extent = vectorSource.getExtent();
        map.getView().fit(extent, { maxZoom: 16, duration: 1000 });
      }
    };
    reader.readAsText(file);
  }
});

