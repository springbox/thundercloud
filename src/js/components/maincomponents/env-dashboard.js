let React = require('react');
let PageView = require('../pageview');
let Router = require('react-router');
let Route = Router.Route;
let ReactFire = require('reactfire');
let Firebase = require('firebase');
let AppActions = require('../../actions/app-actions.js');
let Link = Router.Link;
let Navigation = require('react-router').Navigation;
let CustomLineChart = require('../subcomponents/custom-line-chart');
let FireBaseTools = require('../../utils/firebase-tools');
let d3 = require("d3");
let Tappable = require('react-tappable');
let Store = require('../../stores/streaming-store');
let moment = require('moment');
let HeaderTitle = require('../subcomponents/header-title');
let FluxyMixin = require('../../../../node_modules/alt/mixins/FluxyMixin');

/*
  This is the component for the Environment demo.

  When the component mounts, it creates a connection to the
  Firebase Environment url and binds that data to the key 'data'
  on the component state.

  It uses the Fluxy Mixin to setup listeners for changes to the 
  Streaming Store changes. This is for this component to 
  be notified when the device has stopped streaming data.
*/
let EnvDashboard = React.createClass({
  mixins: [Navigation, ReactFire, FluxyMixin],
  statics: {
    storeListeners: {
      _onChange: Store
    }
  },
  _onChange(state){
    if(state && typeof state.streaming !== 'undefined'){
      this.isStreaming = state.streaming;
      this.forceUpdate();
    }
  },
  componentWillMount() {
    if(this.props.params && this.props.params.session){
      let string = window.firebaseURL + 'sessions/'+this.props.params.session+'/environment';
      let ref = new Firebase( string );
      this.setState({'ref':ref});
      this.bindAsArray(ref, 'data');
      if(this.props.params.session){
        let unit = new Firebase( window.firebaseURL + 'sessions/'+this.props.params.session+'/temperatureUnits' );
        this.bindAsObject(unit, 'unit');
      }
    }
    this.isStreaming = false;
  },
  handleResize(e) {
    this.setState({'parentWidth':this.refs.chart.getDOMNode().offsetWidth});
  },
  componentDidMount() {
    this.setState({'parentWidth':this.refs.chart.getDOMNode().offsetWidth});
    window.addEventListener('resize', this.handleResize);
  },
  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize);
  },
  getInitialState() {
    return {
      ref:null,
      parentWidth:400,
      data:[],
      unit:{}
    };
  },
  convertToSI(temp){
    if(temp && temp.length){
      try{
        for(var t in temp[0].values){
          if(temp[0].values[t].hasOwnProperty('y')){
            temp[0].values[t].y = (temp[0].values[t].y  * (9/5)) + 32;
          }
        }
      }catch(e){}
    }
    return temp;
  },
  render() {
    let limiter = this.isStreaming ? 30 : false;
    let temp = FireBaseTools.limitArray(FireBaseTools.findKeyFromArray('temperature',this.state.data), limiter);
    let humid = FireBaseTools.limitArray(FireBaseTools.findKeyFromArray('humidity',this.state.data), limiter);
    let ambientlight = FireBaseTools.limitArray(FireBaseTools.findKeyFromArray('ambientLight',this.state.data), limiter);
    let uv = FireBaseTools.limitArray(FireBaseTools.findKeyFromArray('uvIndex',this.state.data), limiter);
    let header = (<HeaderTitle demoType="motion" title="ENVIRONMENT" color="#a1b92e"/>);
    var skipsTime;
    if(temp && temp.skipsTime){
      skipsTime = (<h3 className="timeskip"><sup>*</sup>Results may include connection loss.</h3>);
    }
    var unit = 'C';
    var metric = true;
    if(this.state.unit && typeof this.state.unit[".value"] != 'undefined'){
      if(this.state.unit[".value"] == 1){
        unit = 'F';
        metric = false;
        temp = this.convertToSI(temp);
      }
    }
    return (
      <PageView className="dashboard"
                sessionId={this.props.params.session} 
                deviceId={this.props.params.deviceId} 
                dataFormatter={FireBaseTools.formatDataForCSV}
                data={this.state.data}
                nowStreamingData={temp}
                metric={metric}
                csvTitle={FireBaseTools.csvTitle('Environment Data',temp)}
                headerTitle={header}>
        <div className="sections">
          <section className="top-and-bottom">
            <CustomLineChart ref="chart"
                    data={temp}
                    title={"Temperature"}
                    width={this.state.parentWidth}
                    height={260}
                    color={this.dynamicTempColor(temp, metric)}
                    transparentAxis={true}
                    unit={'°' + unit}
                    dataKey={this.currentValue(temp,'°' + unit)}
                    renderAvgLine={true}
                    margin={{top: 10, bottom: 50, left: 35, right: 0}}
                    interpolate={"basis"}/>
            <CustomLineChart ref="chart"
                    data={ambientlight}
                    title={"Ambient Light"}
                    width={this.state.parentWidth}
                    height={260}
                    color={this.dynamicLightColor(ambientlight)}
                    unit={'lx'}
                    dataKey={this.currentValue(ambientlight,'lx')}
                    transparentAxis={true}
                    renderAvgLine={true}
                    margin={{top: 10, bottom: 50, left: 35, right: 0}}
                    interpolate={"basis"}/>
          </section>
          <section className="top-and-bottom">
            <CustomLineChart ref="chart"
                    data={humid}
                    title={"Humidity"}
                    width={this.state.parentWidth}
                    height={260}
                    unit={'%'}
                    color={this.dynamicHumidColor(humid)}
                    transparentAxis={true}
                    dataKey={this.currentValue(humid,'%')}
                    renderAvgLine={true}
                    margin={{top: 10, bottom: 50, left: 35, right: 0}}
                    interpolate={"basis"}/>
            <CustomLineChart ref="chart"
                    data={uv}
                    color={this.dynamicUVColor(uv)}
                    title={"UV Index"}
                    unit={' '}
                    width={this.state.parentWidth}
                    height={260}
                    dataKey={this.currentValue(uv,'')}
                    transparentAxis={true}
                    renderAvgLine={true}
                    margin={{top: 10, bottom: 50, left: 35, right: 0}}
                    interpolate={"basis"}/>
          </section>
          {skipsTime}
        </div>
      </PageView>
    );
  },
  currentValue(data, unit){
    try{
      unit = unit || ' ';
      let value = Math.round(data[0].values[data[0].values.length -1].y * 10) / 10;
      return (
        <h3 className="last-point current">{value} {unit}</h3>
        );
    }
    catch(e){}
    return;
  },
  dynamicTempColor(value, metric){
    try{
      value = value[0].values[value[0].values.length -1].y;
    }
    catch(e){}
    if(metric){
      value = value * (9/5) + 32;
    }
    var color = '#fb2f3c';
    if(value < 0){
      color = '#857cff';
    }
    if(value < -10){
      color = '#333333';
    }
    if(value < -20){
      color = '#c1c1c1';
    }
    if(value >= 0){
      color = '#8a4aff';
    }
    if(value > 10){
      color = '#00aeff';
    }
    if(value > 20){
      color = '#78d6ff';
    }
    if(value > 30){
      color = '#87a10d';
    }
    if(value > 40){
      color = '#a1b92e';
    }
    if(value > 50){
      color = '#caf200';
    }
    if(value > 60){
      color = '#ffcc00';
    }
    if(value > 70){
      color = '#ffa200';
    }
    if(value > 80){
      color = '#ff7469';
    }
    if(value > 90){
      color = '#e65100';
    }
    if(value > 100){
      color = '#fb2f3c';
    }
    return color;
  },
  dynamicHumidColor(value){
    try{
      value = value[0].values[value[0].values.length -1].y;
    }
    catch(e){}
    var color = '#e65100';
    if(value < 65){
      color = '#ff7100';
    }
    if(value < 61){
      color = '#ffa200';
    }
    if(value < 51){
      color = '#ffcc00';
    }
    if(value < 50){
      color = '#a1b92e';
    }
    if(value < 45){
      color = '#00aeff';
    }
    return color;
  },
  dynamicLightColor(value){
    try{
      value = value[0].values[value[0].values.length -1].y;
    }
    catch(e){}
    var color = '#ffa200';
    if(value < 360){
      color = '#ff7100';
    }
    if(value < 320){
      color = '#ff7469';
    }
    if(value < 280){
      color = '#ffe7cf';
    }
    if(value < 240){
      color = '#fff4f1';
    }
    if(value < 200){
      color = '#ffffff';
    }
    if(value < 160){
      color = '#e9e3ff';
    }
    if(value < 120){
      color = '#c3caf8';
    }
    if(value < 80){
      color = '#9196ff';
    }
    if(value < 40){
      color = '#857cff';
    }
    return color;
    
  },
  dynamicUVColor(value){
    try{
      value = value[0].values[value[0].values.length -1].y;
    }
    catch(e){}
    var color = '#857cff';
    if(value < 11){
      color = '#e65100';
    }
    if(value < 8){
      color = '#ffa200';
    }
    if(value < 6){
      color = '#ffcc00';
    }
    if(value < 3){
      color = '#a1b92e';
    }
    return color;
  }
});
module.exports = EnvDashboard;