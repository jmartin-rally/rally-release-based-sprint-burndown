/*
 * Displays a burndown chart.  
 * 
 * Change show_teams to true to show broken down by teams with normalized burndown
 * Change show_teams to false to show aggregated
 * 
 * The normalization is: percentage of task remaining / highest task estimate day
 * 
 */
 Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    version: "0.6",
    show_teams: true,
    hide_weekends: true,
    defaults: { margin: 5 },
    items: [ 
        {xtype: 'container', itemId: 'selector_box', layout: { type: 'hbox' } },
        {xtype: 'container', itemId: 'chart_box'},
        {xtype: 'container', itemId: 'notes_box', html: 'This chart calculates "work required" based on the highest set of estimates on day 1 or day 2' }
    ],
    iteration_start: null,
    iteration_end: null,
    number_of_days_in_iteration: 0,
    applied_state: null,
    launch: function() {
        this._addTimeboxSelectors();
    },
    _addTimeboxSelectors: function() {
        var first_time = true;
        var me = this;
        this.down('#selector_box').add({
            xtype: 'rallyreleasecombobox',
            itemId: 'release_box',
            stateId: 'pxs.burndown.release',
            stateful: true,
            stateEvents: ['change'],
            getState: function() {
                return { value: this.getRawValue() };
            },
            applyState: function(state) {
                if ( state && state.value ) {
                    me.applied_state = state.value;
                    //this.setRawValue(state.value);
                }
            },
            listeners: {
                change: function() {
                    this._gatherData();
                },
                ready: function(cb) {
                    // applyState (above) seems to work before the data is loaded
                    if (this.applied_state) {
                        var same_release = cb.findRecordByDisplay(this.applied_state);
                        if ( same_release ) {
                            cb.setValue(same_release);
                        }
                    }
                    this._gatherData();
                },
                scope: this
            },
            storeConfig: {
                listeners: {
                    load: function(store) {
                        if ( first_time ) {
                            store.loadData([{formattedName: '--ANY--',
                                            formattedStartDate: 'n/a',
                                            formattedEndDate: 'n/a',
                                            Name: '--ANY--',
                                            isSelected: false}],
                                            true);
                            store.sort('formattedStartDate', 'DESC');
                            first_time = false;
                        }
                        
                     }
                }
            }
        });
        this.down('#selector_box').add({
            xtype: 'rallyiterationcombobox',
            itemId: 'iteration_box',
            listeners: {
                change: function() {
                    this._gatherData();
                },
                ready: function() {
                    this._gatherData();
                },
                scope: this
            }
        });
    },
    _getDateArray: function(start_date,end_date,use_short_form) {
        window.console && console.log("_getDateArray",start_date,end_date);
        var date_array = [];
        var almost_midnight = Rally.util.DateTime.add(start_date,"minute",1435);
        var counter = 1;
        while( almost_midnight < end_date ) {
            window.console && console.log("almost midnight", almost_midnight);
            if ( ! this.hide_weekends || ( almost_midnight.getDay() !== 0 && almost_midnight.getDay() !== 6 )) {
                if ( use_short_form ) {
                    //date_array.push(Rally.util.DateTime.format(almost_midnight,'d M'));
                    date_array.push("Day " + counter);
                    counter++;
                } else {
                    date_array.push(almost_midnight);
                }
            }
            almost_midnight = Rally.util.DateTime.add(almost_midnight,"day",1);
        }
        return date_array;
    },
    _gatherData: function() {
        window.console && console.log("_gatherData:",this.down('#release_box').getRecord());
        if(this.chart){ this.chart.destroy(); }
        if ( this.down('#release_box').getRecord() && this.down('#iteration_box').getRecord() ) {
            window.console && console.log("SPRINT:",this.down('#iteration_box').getRecord());
            var selected_release = this.down('#release_box').getRecord();
            var selected_iteration = this.down('#iteration_box').getRecord();
            this.release_name = selected_release.get('Name');
            this.iteration_name = selected_iteration.get('Name');
            this.iteration_start = this._normalizeDate( selected_iteration.get('StartDate') );
            this.iteration_end = this._normalizeDate( selected_iteration.get('EndDate') );
            this._getIterations();
        }
    },
    _normalizeDate: function(jsdate){
        return Rally.util.DateTime.fromIsoString(Rally.util.DateTime.toIsoString(jsdate,true));
    },
    _getIterations: function() {
        var me = this;
        this.iteration_oids = [];
        this.team_names = {}; // key is team objectid
        this.team_data = {}; // key will be team objectid
        Ext.create('Rally.data.WsapiDataStore',{
            model: 'Iteration',
            autoLoad: true,
            filters: { property: 'Name', value: me.iteration_name },
            fetch:['EndDate','StartDate','Project','Name','ObjectID'],
            listeners: {
                load: function(store,data,success) {
                    Ext.Array.each(data,function(item){
                        me.team_names[item.get('Project').ObjectID] = item.get('Project').Name;
                        me.team_data[item.get('Project').ObjectID] = {};
                        me.iteration_oids.push(item.get('ObjectID'));
                    });
                    me._getReleases();
                }
            }
        });
    },
    _getReleases: function() {
        window.console && console.log( "_getReleases" );
        var me = this;
        this.release_oids = [];
        Ext.create('Rally.data.WsapiDataStore',{
            model: 'Release',
            autoLoad: true,
            filters: { property: 'Name', value: me.release_name },
            listeners: {
                load: function(store,data,success) {
                    Ext.Array.each(data,function(item){
                        me.release_oids.push(item.get('ObjectID'));
                    });
                    me._getSnapshots();
                }
            }
        });
    },
    _getSnapshots: function() {
        window.console && console.log( "_getSnapshots" );
        var date_array = this._getDateArray(this.iteration_start, this.iteration_end);
        this.number_of_days_in_iteration = date_array.length;
        this.task_days = {};
        this._getEndOfOneDaySnaps(date_array);
    },
    _getEndOfOneDaySnaps: function(date_array) {
        window.console && console.log( "_getEndOfOneDaySnaps", date_array);
        var midnight = date_array.shift();
        var query = [
            {property:'_TypeHierarchy',operator:'in',value:['Defect','HierarchicalRequirement','TestSet']},
            {property:'_ProjectHierarchy',operator:'=',value: this.getContext().getProject().ObjectID},
            {property:'__At',value:midnight},
            {property:'Iteration',operator:'in',value:this.iteration_oids}
        ];
        if ( this.release_oids.length > 0 ) {
            query.push({property:'Release',operator:'in',value:this.release_oids});
        }
        Ext.create('Rally.data.lookback.SnapshotStore',{
            autoLoad: true,
            fetch: ['TaskRemainingTotal','Iteration','_UnformattedID','TaskEstimateTotal'],
            filters: query,
            listeners: {
                load: function(store,data,success) {
                    window.console && console.log("load",midnight,data);
                    var me = this;
                    var task_day = Ext.create('Rally.pxs.data.TaskDay',{IsoDate:midnight});
                    var short_date = task_day.get('ShortIsoDate');
                    Ext.Array.each(data,function(snap) {
                        task_day.addTo("TaskRemainingTotal",snap.get('TaskRemainingTotal'));
                        task_day.addTo("TaskEstimateTotal",snap.get('TaskEstimateTotal'));
                        var project_oid = snap.get('Project');
                        if ( ! me.team_data[project_oid][short_date]){
                            me.team_data[project_oid][short_date] = Ext.create('Rally.pxs.data.TaskDay',{IsoDate:midnight});
                        }
                        me.team_data[project_oid][short_date].addTo("TaskRemainingTotal",snap.get('TaskRemainingTotal'));
                        me.team_data[project_oid][short_date].addTo("TaskEstimateTotal",snap.get('TaskEstimateTotal'));
                    });
                    this.task_days[short_date] = task_day;
                    
                    if ( date_array.length > 0 ) {
                        this._getEndOfOneDaySnaps(date_array);
                    } else {
                        this._report();
                    }
                },
                scope: this
            }
        });
    },
    _report: function() {
        window.console && console.log("_report, show_teams:", this.show_teams, "; team_data:", this.team_data);
        this._setIdeals();

        if ( this.show_teams ) { 
            this._showSegregatedChart();
        } else {
            this._showCombinedChart();
        }
    },
    /* chart with "normalized" burndown for each Rally project in scope. */
    _showSegregatedChart: function() {
        window.console && console.log("_showSegregatedChart");
        this._normalizeTeamData();
        var data_array = this._hashToArray(this.task_days);
        
        var chart_store = Ext.create('Rally.data.custom.Store',{
            autoLoad: true,
            data: data_array
        });
        if(this.chart){ this.chart.destroy(); }
        var series = [];
        series.push({type: 'line', dataIndex: 'IdealTaskRemainingPercent', name: 'Work Required', visible: true});
        for ( var team_id in this.team_names ) {
            if ( this.team_names.hasOwnProperty(team_id) ){
                series.push({type: 'line', dataIndex: this.team_names[team_id], name: this.team_names[team_id], visible: true});
            }
        }
        window.console && console.log( "Series:",series );
        this.chart = Ext.create('Rally.ui.chart.Chart',{
            height: 400,
            store: chart_store,
            series: series,
            chartConfig: {
                chart: {},
                colors: ['#000','#00f'],
                title: { text: 'Normalized Iteration Burn Down', align: 'center' },
                xAxis: {
                    title: { text: ""},
                    categories: this._getDateArray(this.iteration_start, this.iteration_end, true)
                },
                yAxis: [{
                    title: { text: ""},
                    plotLines: [{color:'#000',width: 2, value: 0}]
                }],
                exporting: { enabled: true }
            }
        });
        this.down('#chart_box').add(this.chart);
    },
    _showCombinedChart: function() {
        window.console && console.log("_showCombinedChart",this.task_days);
        var data_array = this._hashToArray(this.task_days);
        var chart_store = Ext.create('Ext.data.Store',{
            autoLoad: true,
            data: {data:data_array},
            model: 'Rally.pxs.data.TaskDay',
            proxy: {
                type: 'memory',
                reader: {
                    type: 'json',
                    root: 'data'
                }
            }
        });
        if(this.chart){ this.chart.destroy(); }
        this.chart = Ext.create('Rally.ui.chart.Chart',{
            height: 400,
            store: chart_store,
            series: [
                {type: 'column',dataIndex:'IdealTaskRemainingDelta',name:'Remaining to Required', visible: true, dataLabels:{
                    enabled: true
                }},
                {type: 'line', dataIndex: 'IdealTaskRemainingTotal', name: 'Work Required', visible: true},
                {type: 'line', dataIndex: 'TaskRemainingTotal', name: 'Work Remaining', visible: true}
            ],
            chartConfig: {
                chart: {},
                colors: ['#fc3','#000','#00f'],
                title: { text: 'Release Based Iteration Burn Down', align: 'center' },
                xAxis: {
                    title: { text: ""},
                    categories: this._getDateArray(this.iteration_start, this.iteration_end, true)
                },
                yAxis: [{
                    title: { text: ""},
                    plotLines: [{color:'#000',width: 2, value: 0}]
                }],
                exporting: { enabled: true }
            }
        });
        this.down('#chart_box').add(this.chart);
    },
    _setIdeals: function(){
        var date_array = this._getDateArray(this.iteration_start, this.iteration_end);
        var start_iso = Rally.util.DateTime.toIsoString(date_array[0],true).replace(/T.*$/,"");
        window.console && console.log( "Set Ideal for First Day:",start_iso);
        //var ideal_top = this.task_days[start_iso].get('TaskRemainingTotal');
        var ideal_top = this._getHighEstimate(this.task_days);
        var ideal_drop = ideal_top/(this.number_of_days_in_iteration-1);
        var ideal_drop_percent = 100/(this.number_of_days_in_iteration-1);
        
        // ASSUMES that the hash is in date order.  TODO: CHALLENGE this assumption
        var daily_ideal = ideal_top;
        var daily_ideal_percent = 100;
        for (var day in this.task_days ) {
            if (this.task_days.hasOwnProperty(day)){
                this.task_days[day].set('IdealTaskRemainingTotal',daily_ideal);
                this.task_days[day].set('IdealTaskRemainingPercent',daily_ideal_percent);
                daily_ideal = daily_ideal - ideal_drop;
                if ( daily_ideal < 0 ) { daily_ideal = 0; }
                daily_ideal_percent = daily_ideal_percent - ideal_drop_percent;
                if ( daily_ideal_percent < 0 ) { daily_ideal_percent = 0; }
            }
        }
    },
    _hashToArray: function(hash) {
        var the_array = [];
        var today = Rally.util.DateTime.toIsoString(new Date(),false).replace(/T.*$/,"");
        for (var key in hash ) {
            if (hash.hasOwnProperty(key)){
                var day_snap = hash[key];
                if ( key > today ) {
                    day_snap.set('Future',true);
                }
                // not sure why the model can't be pushed straight into the store
                //the_array.push(hash[key].getData());
                the_array.push(hash[key].data);
            }
        }

        return the_array;
    },
    _getHighEstimate: function(team_summary) {
        window.console && console.log("_getHighEstimate",team_summary);
        var high_estimate = 0;
        var counter = 0;
        var check_limit = 2;
        for ( var day in team_summary ) {
            if ( counter < check_limit ) {
                var day_estimate = team_summary[day].get('TaskEstimateTotal');
                window.console && console.log("Day",counter,"limit",check_limit,"Estimate",day_estimate);
                if ( day_estimate > high_estimate ) {
                    high_estimate = day_estimate;
                }
                counter++;
            }
        };
        return high_estimate;
    },
    _initializeTeamToNull: function(team_name) {
        for ( var midnight in this.task_days ) {
            if ( this.task_days.hasOwnProperty(midnight) ) {
                this.task_days[midnight].set(team_name,null);
            }
        }
    },
    _normalizeTeamData: function() {
        window.console && console.log("_normalizeTeamData",this.task_days);
        var me = this;
        var date_array = this._getDateArray(this.iteration_start, this.iteration_end);
        var start_iso = Rally.util.DateTime.toIsoString(date_array[0],true).replace(/T.*$/,"");
        var today = Rally.util.DateTime.toIsoString(new Date(),false).replace(/T.*$/,"");
        
        for ( var team_id in this.team_data ) {
            if ( this.team_data.hasOwnProperty(team_id) ) {
                var team_name = this.team_names[team_id];
                window.console && console.log("TEAM:",team_name);
                this._initializeTeamToNull(team_name);
                var data_array = this._hashToArray(this.team_data[team_id]);
                if ( data_array.length > 0 ) {
                    var team_top = this._getHighEstimate(this.team_data[team_id]);
                    window.console && console.log( "Team High:",team_top);
                    Ext.Array.each( data_array, function(team_one_day){
                        var midnight = team_one_day.ShortIsoDate;
                        var percentage = ( parseInt( 1000 * team_one_day.TaskRemainingTotal/team_top ) / 10 );
                        if ( isNaN(percentage) || midnight > today ) { 
                            percentage = null; 
                        }
                        window.console && console.log("..",midnight,percentage);
                        //me.task_days[midnight].set(team_name, team_one_day.TaskRemainingTotal);
                        me.task_days[midnight].set(team_name,percentage);
                    });
                }
            }
        }
        return this._hashToArray(this.task_days);
    },
    _limitDecimals: function(initial_value) {
        return parseInt( 10*initial_value, 10 ) / 10;
    }
});
